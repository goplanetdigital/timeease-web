import {get} from "@vercel/blob";
import type {CheckoutTokenPayload} from "./checkout-binding.ts";

export async function verifyStoredIntake(
 binding:CheckoutTokenPayload,
 token:string
):Promise<boolean>{
 const file=await get("intake-v2/"+binding.intakeId+"/manifest.json",{access:"private",token});
 if(!file?.stream)return false;
 // A private manifest is expected to be small. Reject oversized or malformed
 // content while streaming instead of buffering an unbounded blob.
 const reader=file.stream.getReader();
 const chunks:Uint8Array[]=[];
 let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>100000){await reader.cancel();return false;}
   chunks.push(value);
  }
 }catch{return false}
 const bytes=new Uint8Array(size);
 let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 let raw:unknown;
 try{raw=JSON.parse(new TextDecoder().decode(bytes))}catch{return false}
 if(!raw||typeof raw!=="object")return false;
 const data=raw as {
  id?:unknown;variantId?:unknown;status?:unknown;checkoutOrderId?:unknown;
  quote?:{amountUsd?:unknown;currency?:unknown};
  files?:Array<{pathname?:unknown;bytes?:unknown}>;
 };
 if(data.id!==binding.intakeId||data.variantId!==binding.variantId||
 data.quote?.amountUsd!==binding.amountUsd||data.quote?.currency!=="USD"||
 data.status!=="AWAITING_PAYMENT"||data.checkoutOrderId!==null||
 !Array.isArray(data.files)||data.files.length<1||data.files.length>100)return false;
 let total=0;
 const seen=new Set<string>();
 for(const file of data.files){
  if(typeof file.pathname!=="string"||
   !file.pathname.startsWith("intake-v2/"+binding.intakeId+"/file-")||
   file.pathname.includes("..")||seen.has(file.pathname)||
   !Number.isSafeInteger(file.bytes)||Number(file.bytes)<1)return false;
  seen.add(file.pathname);
  total+=Number(file.bytes);
 }
 return total<=3*1024*1024;
}
