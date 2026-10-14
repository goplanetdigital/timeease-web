import {createHmac,timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {verifyBoundShopifyOrder} from "../../../../lib/shopify-bound-order";
import {verifyStoredIntake} from "../../../../lib/verify-stored-intake";

export const runtime="nodejs";

function authenticated(raw:string,signature:string|null,secret:string):boolean {
 if(!signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature))return false;
 const expected=createHmac("sha256",secret).update(raw,"utf8").digest();
 const supplied=Buffer.from(signature,"base64");
 return supplied.length===expected.length && timingSafeEqual(supplied,expected);
}

// Isolated, fail-closed verification endpoint. It deliberately does NOT mark
// an intake paid, start a worker, or accept a client-provided order status.
export async function POST(req:NextRequest){
 const secret=process.env.SHOPIFY_WEBHOOK_SECRET;
 if(!secret)return NextResponse.json({error:"WEBHOOK_NOT_CONFIGURED"},{status:503});
 const length=req.headers.get("content-length");
 if(length&&(!/^[0-9]+$/.test(length)||Number(length)>1048576))return NextResponse.json({error:"WEBHOOK_PAYLOAD_TOO_LARGE"},{status:413});
 const raw=await req.text();
 if(Buffer.byteLength(raw,"utf8")>1024*1024)return NextResponse.json({error:"WEBHOOK_PAYLOAD_TOO_LARGE"},{status:413});
 if(!authenticated(raw,req.headers.get("x-shopify-hmac-sha256"),secret))
  return NextResponse.json({error:"INVALID_WEBHOOK_SIGNATURE"},{status:401});
 const expectedShop=process.env.SHOPIFY_SHOP_DOMAIN;
 if(expectedShop && req.headers.get("x-shopify-shop-domain")!==expectedShop)
  return NextResponse.json({error:"UNEXPECTED_SHOP"},{status:403});
 const topic=req.headers.get("x-shopify-topic");
 if(topic!=="orders/paid")
  return NextResponse.json({error:"UNSUPPORTED_WEBHOOK_TOPIC"},{status:422});
 let order:unknown;
 try{order=JSON.parse(raw)}catch{return NextResponse.json({error:"INVALID_JSON"},{status:400})}
 if(!order||typeof order!=="object"||!("id" in order)||!("financial_status" in order))
  return NextResponse.json({error:"INVALID_ORDER"},{status:400});
 const payload=order as {id:unknown;financial_status:unknown};
 if((typeof payload.id!=="number"&&typeof payload.id!=="string")||payload.financial_status!=="paid")
  return NextResponse.json({error:"ORDER_NOT_PAID"},{status:422});
 const bindingSecret=process.env.TIMEEASE_CHECKOUT_BINDING_SECRET;
 if(!bindingSecret)return NextResponse.json({error:"CHECKOUT_BINDING_NOT_CONFIGURED"},{status:503});
 const binding=verifyBoundShopifyOrder(order as Parameters<typeof verifyBoundShopifyOrder>[0],bindingSecret);
 if(!binding)return NextResponse.json({error:"INVALID_ORDER_INTAKE_BINDING"},{status:422});
 const storageToken=process.env.BLOB_READ_WRITE_TOKEN;
 if(!storageToken)return NextResponse.json({error:"STORAGE_NOT_CONFIGURED"},{status:503});
 if(!await verifyStoredIntake(binding,storageToken))return NextResponse.json({error:"BOUND_INTAKE_MISMATCH"},{status:422});
 // No state changes until the Shopify order ID is bound to a private intake
 // and the paid order's line items and price have been independently checked.
 return NextResponse.json({error:"PAID_ORDER_LINKING_NOT_ENABLED"},{status:503,headers:{"Cache-Control":"no-store"}});
}
