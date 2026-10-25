import {createHash,timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {quarantineStaleProcessingJobs} from "../../../../lib/paid-job-claim";
export const runtime="nodejs";
const reply=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
/** Quarantine only. Never re-claim or resend customer email. */
export async function POST(req:NextRequest){
 const secret=process.env.TIMEEASE_V2_WORKER_SECRET;
 if(!secret||secret.length<32||process.env.TIMEEASE_V2_PAYMENT_LEDGER_ENABLED!=="true")
  return reply({error:"WORKER_NOT_CONFIGURED"},503);
 const auth=req.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer ")||auth.length<=7||auth.length>519)return reply({error:"UNAUTHORIZED"},401);
 if(!timingSafeEqual(createHash("sha256").update(auth.slice(7)).digest(),createHash("sha256").update(secret).digest()))
  return reply({error:"UNAUTHORIZED"},401);
 const length=req.headers.get("content-length");
 if(length&&(!/^\d+$/.test(length)||Number(length)>1024))return reply({error:"REQUEST_TOO_LARGE"},413);
 let body:unknown;
 try{const raw=await req.text();if(Buffer.byteLength(raw)>1024)return reply({error:"REQUEST_TOO_LARGE"},413);body=JSON.parse(raw)}
 catch{return reply({error:"INVALID_JSON"},400)}
 if(!body||typeof body!=="object"||Array.isArray(body))return reply({error:"INVALID_BODY"},400);
 const b=body as Record<string,unknown>;
 if(Object.keys(b).some(k=>!["olderThanMinutes","limit"].includes(k)))return reply({error:"INVALID_BODY"},400);
 const olderThanMinutes=b.olderThanMinutes??15,limit=b.limit??20;
 if(!Number.isInteger(olderThanMinutes)||Number(olderThanMinutes)<10||Number(olderThanMinutes)>1440||
    !Number.isInteger(limit)||Number(limit)<1||Number(limit)>100)return reply({error:"INVALID_PARAMETERS"},400);
 try{
  const intakeIds=await quarantineStaleProcessingJobs(Number(olderThanMinutes),Number(limit));
  return reply({ok:true,quarantined:intakeIds.length,intakeIds},200);
 }catch{return reply({error:"RECOVERY_UNAVAILABLE"},503)}
}
