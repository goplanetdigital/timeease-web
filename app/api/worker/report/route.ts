import {createHash,timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {markResultReady,markDelivered,flagForReview} from "../../../../lib/paid-job-claim";
import {head} from "@vercel/blob";
export const runtime="nodejs";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(data:unknown,status:number)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
function authorized(req:NextRequest,secret:string){
 const h=req.headers.get("authorization")||"";
 if(!h.startsWith("Bearer ")||h.length>519)return false;
 const a=createHash("sha256").update(h.slice(7)).digest();
 const b=createHash("sha256").update(secret).digest();
 return timingSafeEqual(a,b);
}
/** Worker reports only durable, independently produced outputs; no user-facing invocation. */
export async function POST(req:NextRequest){
 const secret=process.env.TIMEEASE_V2_WORKER_SECRET;
 if(!secret||secret.length<32||process.env.TIMEEASE_V2_PAYMENT_LEDGER_ENABLED!=="true")
  return reply({error:"WORKER_NOT_CONFIGURED"},503);
 if(!authorized(req,secret))return reply({error:"UNAUTHORIZED"},401);
 const length=req.headers.get("content-length");
 if(length&&(!/^\d+$/.test(length)||Number(length)>4096))return reply({error:"REQUEST_TOO_LARGE"},413);
 if(!req.body)return reply({error:"INVALID_JSON"},400);
 const reader=req.body.getReader();
 const chunks:Buffer[]=[];
 let size=0;
 while(true){
  const {done,value}=await reader.read();
  if(done)break;
  size+=value.byteLength;
  if(size>4096){
   await reader.cancel();
   return reply({error:"REQUEST_TOO_LARGE"},413);
  }
  chunks.push(Buffer.from(value));
 }
 let body:unknown;
 try{body=JSON.parse(Buffer.concat(chunks,size).toString("utf8"))}
 catch{return reply({error:"INVALID_JSON"},400)}
 if(!body||typeof body!=="object")return reply({error:"INVALID_BODY"},400);
 const b=body as Record<string,unknown>;
 if(typeof b.intakeId!=="string"||!UUID.test(b.intakeId))return reply({error:"INVALID_INTAKE_ID"},400);
 try{
  if(b.action==="result_ready"&&typeof b.resultPath==="string"){
   if(b.resultPath!=="results-v2/"+b.intakeId+"/consolidated.xlsx")
    return reply({error:"INVALID_RESULT_PATH"},400);
   const token=process.env.BLOB_READ_WRITE_TOKEN;
   if(!token)return reply({error:"STORAGE_NOT_CONFIGURED"},503);
   let blob;
   try{blob=await head(b.resultPath,{token})}
   catch{return reply({error:"RESULT_NOT_STORED"},409)}
   if(!blob||blob.size<=0||blob.size>20*1024*1024||
      blob.contentType!=="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    return reply({error:"INVALID_STORED_RESULT"},409);
   const ok=await markResultReady(b.intakeId,b.resultPath);
   return reply({ok},ok?200:409);
  }
  if(b.action==="delivered"&&typeof b.messageId==="string"){
   const ok=await markDelivered(b.intakeId,b.messageId);
   return reply({ok},ok?200:409);
  }
  if(b.action==="review"&&typeof b.reason==="string"){
   const ok=await flagForReview(b.intakeId,b.reason);
   return reply({ok},ok?200:409);
  }
  return reply({error:"INVALID_ACTION"},400);
 }catch{return reply({error:"WORKER_LEDGER_UNAVAILABLE"},503)}
}
