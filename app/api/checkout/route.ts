import {get} from "@vercel/blob";
import {INTERNAL_E2E_USD1,assertInternalE2EPrice} from "../../../lib/internal-e2e-pricing";
import {createHash,timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {calculateQuote,type QuoteInput,type TimeEaseService} from "../../../lib/upload-first-pricing";
import {resolveShopifyVariant} from "../../../lib/shopify-variants";
import {buildBoundCartPermalink} from "../../../lib/shopify-cart-link";
import {checkoutIsEnabled,checkoutTestPrerequisitesReady} from "../../../lib/checkout-readiness";
import {paymentLedgerSchemaReady} from "../../../lib/payment-ledger-schema-ready";
export const runtime="nodejs";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(req:NextRequest){
 try{
  const {id,testMode}=await req.json();
  const requestedTest=testMode===true;
  let authorizedTest=false;
  if(requestedTest){
   const expected=process.env.TIMEEASE_V2_WORKER_SECRET;
   const supplied=req.headers.get("authorization");
   if(!expected||expected.length<32||!supplied?.startsWith("Bearer "))return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
   const a=createHash("sha256").update(supplied.slice(7)).digest();
   const b=createHash("sha256").update(expected).digest();
   if(!timingSafeEqual(a,b))return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
   authorizedTest=true;
  }
  if(typeof id!=="string"||!ID.test(id))
   return NextResponse.json({error:"INVALID_INTAKE_ID"},{status:400});
  if(!process.env.BLOB_READ_WRITE_TOKEN)
   return NextResponse.json({error:"STORAGE_NOT_CONFIGURED"},{status:503});
  // Never accept quote, variant, or payment status from the browser.
  const blob=await get("intake-v2/"+id+"/manifest.json",{access:"private",token:process.env.BLOB_READ_WRITE_TOKEN});
  if(!blob||!blob.stream)return NextResponse.json({error:"INTAKE_NOT_FOUND"},{status:404});
  const reader=blob.stream.getReader();
  const chunks:Uint8Array[]=[];
  let size=0;
  while(true){
   const chunk=await reader.read();
   if(chunk.done)break;
   size+=chunk.value.byteLength;
   if(size>100000){
    await reader.cancel();
    return NextResponse.json({error:"MANIFEST_TOO_LARGE"},{status:413});
   }
   chunks.push(chunk.value);
  }
  const manifest=JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
   id?:string;service?:TimeEaseService;quote?:{amountUsd?:number};
   variantId?:string;files?:Array<{pathname?:string;bytes?:number}>;status?:string;
   quoteInput?:QuoteInput;checkoutOrderId?:unknown;internalE2ETest?:unknown;
  };
  if(manifest.id!==id||manifest.status!=="AWAITING_PAYMENT"||manifest.checkoutOrderId!==null||!Array.isArray(manifest.files)||manifest.files.length<1||manifest.files.length>100)
   return NextResponse.json({error:"INVALID_INTAKE_STATE"},{status:409});
  const service=manifest.service;
  if(!service||!["invoice","consolidation","catalogue","resume"].includes(service))
   return NextResponse.json({error:"INVALID_INTAKE_SERVICE"},{status:409});
  const totalBytes=manifest.files.reduce((sum,f)=>sum+(typeof f.bytes==="number"?f.bytes:0),0);
  if(!Number.isSafeInteger(totalBytes)||totalBytes<1||totalBytes>3*1024*1024)
   return NextResponse.json({error:"INVALID_INTAKE_SIZE"},{status:409});
  const paths=new Set<string>();
  // Confirm each recorded file is under the private intake prefix.
  if(manifest.files.some(f=>typeof f.pathname!=="string"||!f.pathname.startsWith("intake-v2/"+id+"/file-")||!Number.isSafeInteger(f.bytes)||!f.bytes||f.bytes<1))
   return NextResponse.json({error:"INVALID_INTAKE_FILES"},{status:409});
  for(const file of manifest.files){
   if(!file.pathname||paths.has(file.pathname)||file.pathname.includes(".."))
    return NextResponse.json({error:"DUPLICATE_OR_INVALID_FILE"},{status:409});
   paths.add(file.pathname);
  }
  // Variant and amount are server-stored; no browser-supplied prices accepted.
  if(!manifest.variantId||!manifest.quote||!Number.isSafeInteger(manifest.quote.amountUsd))
   return NextResponse.json({error:"INVALID_INTAKE_QUOTE"},{status:409});
  if(!manifest.quoteInput||manifest.quoteInput.service!==service||manifest.quoteInput.fileCount!==manifest.files.length)
   return NextResponse.json({error:"INVALID_QUOTE_INPUT"},{status:409});
  const isTestManifest=manifest.internalE2ETest===true;
  if(isTestManifest&&!authorizedTest)return NextResponse.json({error:"INTERNAL_TEST_AUTH_REQUIRED"},{status:401});
  const internalE2E=isTestManifest&&authorizedTest&&manifest.variantId===INTERNAL_E2E_USD1.variantId&&manifest.quote.amountUsd===1;
  if(internalE2E)assertInternalE2EPrice(authorizedTest,manifest.variantId,manifest.quote.amountUsd);
  const recomputed=calculateQuote(manifest.quoteInput);
  const variant=internalE2E?INTERNAL_E2E_USD1.variantId:resolveShopifyVariant(recomputed,manifest.files.length);
  if((isTestManifest&&!internalE2E)||(!internalE2E&&recomputed.amountUsd!==manifest.quote.amountUsd)||variant!==manifest.variantId)
   return NextResponse.json({error:"STORED_QUOTE_MISMATCH"},{status:409});
  if(recomputed.requiresReview || (service!=="invoice" && service!=="consolidation")) return NextResponse.json({error:"SERVICE_NOT_READY"},{status:503});
  // Multiple independent gates prevent accepting payments before delivery is verified.
  const bindingSecret=process.env.TIMEEASE_CHECKOUT_BINDING_SECRET;
  const webhookSecret=process.env.SHOPIFY_WEBHOOK_SECRET;
  const shopDomain=process.env.SHOPIFY_SHOP_DOMAIN;
  const checkoutPermitted=checkoutIsEnabled()||(authorizedTest&&checkoutTestPrerequisitesReady());
  if(checkoutPermitted&&await paymentLedgerSchemaReady()&&bindingSecret&&webhookSecret&&shopDomain){
   const checkoutUrl=buildBoundCartPermalink({
    intakeId:id,
    variantId:manifest.variantId,
    amountUsd:internalE2E?1:recomputed.amountUsd,
    expiresAt:Math.floor(Date.now()/1000)+1800
   },bindingSecret,shopDomain);
   return NextResponse.json({checkoutUrl,id,amountUsd:internalE2E?1:recomputed.amountUsd,testMode:authorizedTest},{headers:{"Cache-Control":"no-store"}});
  }
  // Checkout stays disabled until authenticated paid-order linkage and worker delivery are ready.
  return NextResponse.json({
   error:"CHECKOUT_NOT_YET_ENABLED",
   intakeVerified:true,
   amountUsd:manifest.quote.amountUsd,
   variantConfigured:Boolean(manifest.variantId)
  },{status:503,headers:{"Cache-Control":"no-store"}});
 }catch(e){
  console.error("checkout_intake_validation_failed",e instanceof Error?e.message:"unknown");
  return NextResponse.json({error:"INVALID_REQUEST_OR_INTAKE"},{status:400});
 }
}
