import {productionReleaseBound,acceptingProductionWork} from "../../../../lib/production-release";
import {productionTransaction} from "../../../../lib/production-database";
import {holdShopifyPayment} from "../../../../lib/payment-reversal";
import {shopifyPaymentState} from "../../../../lib/shopify-payment-state";
import {blobAccessConfigured,blobAccessOptions} from "../../../../lib/blob-access";
import {previewBlobAccessBlocked} from "../../../../lib/preview-blob-guard";
import {createHmac,timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {verifyBoundShopifyOrder} from "../../../../lib/shopify-bound-order";
import {verifyStoredIntake} from "../../../../lib/verify-stored-intake";
import {recordVerifiedPayment} from "../../../../lib/paid-order-ledger";

export const runtime="nodejs";

function authenticated(raw:string,signature:string|null,secret:string):boolean {
 if(!signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature))return false;
 const expected=createHmac("sha256",secret).update(raw,"utf8").digest();
 const supplied=Buffer.from(signature,"base64");
 return supplied.length===expected.length && timingSafeEqual(supplied,expected);
}

// Authenticated payment authority; never starts a Worker or sends mail.
export async function POST(req:NextRequest){
 if(previewBlobAccessBlocked(process.env))return NextResponse.json({error:"PREVIEW_BLOB_ISOLATION_REQUIRED"},{status:503,headers:{"Cache-Control":"no-store"}});
 if(!productionReleaseBound())return NextResponse.json({error:"PRODUCTION_RELEASE_CLOSED"},{status:503});
 const secret=process.env.SHOPIFY_WEBHOOK_SECRET;
 if(!secret)return NextResponse.json({error:"WEBHOOK_NOT_CONFIGURED"},{status:503});
 const length=req.headers.get("content-length");
 if(length&&(!/^[0-9]+$/.test(length)||Number(length)>1048576))return NextResponse.json({error:"WEBHOOK_PAYLOAD_TOO_LARGE"},{status:413});
 if(!req.body)return NextResponse.json({error:"INVALID_JSON"},{status:400});
 const reader=req.body.getReader();
 const chunks:Buffer[]=[];
 let bytes=0;
 while(true){
  const {done,value}=await reader.read();
  if(done)break;
  bytes+=value.byteLength;
  if(bytes>1024*1024){
   await reader.cancel();
   return NextResponse.json({error:"WEBHOOK_PAYLOAD_TOO_LARGE"},{status:413});
  }
  chunks.push(Buffer.from(value));
 }
 const raw=Buffer.concat(chunks,bytes).toString("utf8");
 if(!authenticated(raw,req.headers.get("x-shopify-hmac-sha256"),secret))
  return NextResponse.json({error:"INVALID_WEBHOOK_SIGNATURE"},{status:401});
 // Log only authenticated delivery metadata; never log payloads, signatures, or customer data.
 console.info("shopify_webhook_signature_verified",{topic:req.headers.get("x-shopify-topic")||"missing"});
 const expectedShop=process.env.SHOPIFY_SHOP_DOMAIN;
 if(!expectedShop)return NextResponse.json({error:"SHOP_DOMAIN_NOT_CONFIGURED"},{status:503});
 if(req.headers.get("x-shopify-shop-domain")!==expectedShop)
  return NextResponse.json({error:"UNEXPECTED_SHOP"},{status:403});
 const topic=req.headers.get("x-shopify-topic");
 let order:unknown;
 try{order=JSON.parse(raw)}catch{return NextResponse.json({error:"INVALID_JSON"},{status:400})}
 if(!order||typeof order!=="object"||Array.isArray(order))return NextResponse.json({error:"INVALID_ORDER"},{status:400});
 const state=shopifyPaymentState(topic,order as Record<string,unknown>);
 if(state.kind==='REJECT')return NextResponse.json({error:"ORDER_NOT_LIVE_PAID_OR_SUPPORTED_REVERSAL"},{status:422});
 if(state.kind==='HOLD'){
  try{const status=await productionTransaction('payment',client=>holdShopifyPayment(state.orderId,expectedShop,state.reason,client));
   return NextResponse.json({status,send:false},{headers:{"Cache-Control":"no-store"}});
  }catch{return NextResponse.json({error:"PAYMENT_HOLD_UNAVAILABLE"},{status:503});}
 }
 if(!acceptingProductionWork())return NextResponse.json({error:"NEW_WORK_FROZEN"},{status:503});
 const bindingSecret=process.env.TIMEEASE_CHECKOUT_BINDING_SECRET;
 if(!bindingSecret)return NextResponse.json({error:"CHECKOUT_BINDING_NOT_CONFIGURED"},{status:503});
 const binding=verifyBoundShopifyOrder(order as Parameters<typeof verifyBoundShopifyOrder>[0],bindingSecret);
 if(!binding)return NextResponse.json({error:"INVALID_ORDER_INTAKE_BINDING"},{status:422});
 const storageConfigured=blobAccessConfigured(process.env);
 if(!storageConfigured)return NextResponse.json({error:"STORAGE_NOT_CONFIGURED"},{status:503});
 if(!await verifyStoredIntake(binding,await blobAccessOptions(process.env)))return NextResponse.json({error:"BOUND_INTAKE_MISMATCH"},{status:422});
 if(process.env.TIMEEASE_V2_PAYMENT_LEDGER_ENABLED!=="true")
  return NextResponse.json({error:"PAID_ORDER_LINKING_NOT_ENABLED"},{status:503});
 try{
  const shop=process.env.SHOPIFY_SHOP_DOMAIN;
  if(!shop)return NextResponse.json({error:"SHOP_DOMAIN_NOT_CONFIGURED"},{status:503});
  const contact=order as {email?:unknown;contact_email?:unknown};
  const candidate=typeof contact.email==="string"?contact.email:contact.contact_email;
  const email=typeof candidate==="string"&&candidate.length<=320?candidate:null;
  const status=await recordVerifiedPayment(binding,state.orderId,shop,email);
  return NextResponse.json({status,delivery:status==="PAYMENT_HELD"?"HELD":"RECORDED_NO_SEND"},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  console.error("paid_order_ledger_failed");
  return NextResponse.json({error:"PAID_ORDER_LEDGER_UNAVAILABLE"},{status:503});
 }
}
