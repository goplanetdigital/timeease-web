import {get} from "@vercel/blob";
import {NextRequest,NextResponse} from "next/server";
import {calculateQuote,type QuoteInput,type TimeEaseService} from "../../../lib/upload-first-pricing";
import {resolveShopifyVariant} from "../../../lib/shopify-variants";
export const runtime="nodejs";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(req:NextRequest){
 try{
  const {id}=await req.json();
  if(typeof id!=="string"||!ID.test(id))
   return NextResponse.json({error:"INVALID_INTAKE_ID"},{status:400});
  if(!process.env.BLOB_READ_WRITE_TOKEN)
   return NextResponse.json({error:"STORAGE_NOT_CONFIGURED"},{status:503});
  // Never accept quote, variant, or payment status from the browser.
  const blob=await get("intake-v2/"+id+"/manifest.json",{access:"private",token:process.env.BLOB_READ_WRITE_TOKEN});
  if(!blob||!blob.stream)return NextResponse.json({error:"INTAKE_NOT_FOUND"},{status:404});
  const manifest=JSON.parse(await new Response(blob.stream).text()) as {
   id?:string;service?:TimeEaseService;quote?:{amountUsd?:number};
   variantId?:string;files?:Array<{pathname?:string;bytes?:number}>;status?:string;
   quoteInput?:QuoteInput;checkoutOrderId?:unknown;
  };
  if(manifest.id!==id||manifest.status!=="AWAITING_PAYMENT"||manifest.checkoutOrderId!==null||!Array.isArray(manifest.files)||manifest.files.length<1||manifest.files.length>100)
   return NextResponse.json({error:"INVALID_INTAKE_STATE"},{status:409});
  const service=manifest.service;
  if(!service||!["invoice","consolidation","catalogue","resume"].includes(service))
   return NextResponse.json({error:"INVALID_INTAKE_SERVICE"},{status:409});
  // Confirm each recorded file is under the private intake prefix.
  if(manifest.files.some(f=>typeof f.pathname!=="string"||!f.pathname.startsWith("intake-v2/"+id+"/file-")||!Number.isSafeInteger(f.bytes)||!f.bytes||f.bytes<1))
   return NextResponse.json({error:"INVALID_INTAKE_FILES"},{status:409});
  // Variant and amount are server-stored; no browser-supplied prices accepted.
  if(!manifest.variantId||!manifest.quote||!Number.isSafeInteger(manifest.quote.amountUsd))
   return NextResponse.json({error:"INVALID_INTAKE_QUOTE"},{status:409});
  if(!manifest.quoteInput||manifest.quoteInput.service!==service||manifest.quoteInput.fileCount!==manifest.files.length)
   return NextResponse.json({error:"INVALID_QUOTE_INPUT"},{status:409});
  const recomputed=calculateQuote(manifest.quoteInput);
  const variant=resolveShopifyVariant(recomputed,manifest.files.length);
  if(recomputed.amountUsd!==manifest.quote.amountUsd||variant!==manifest.variantId)
   return NextResponse.json({error:"STORED_QUOTE_MISMATCH"},{status:409});
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
