import {createHash,timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {claimPaidJob} from "../../../../lib/paid-job-claim";

export const runtime="nodejs";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const response=(data:unknown,status:number)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
function authorized(req:NextRequest,secret:string):boolean{
 const value=req.headers.get("authorization")||"";
 if(!value.startsWith("Bearer "))return false;
 const supplied=value.slice(7);
 if(!supplied||supplied.length>512)return false;
 const a=createHash("sha256").update(supplied).digest();
 const b=createHash("sha256").update(secret).digest();
 return timingSafeEqual(a,b);
}
/** Only an authenticated private worker can claim an already verified paid order. */
export async function POST(req:NextRequest){
 const secret=process.env.TIMEEASE_V2_WORKER_SECRET;
 if(!secret||secret.length<32||process.env.TIMEEASE_V2_PAYMENT_LEDGER_ENABLED!=="true")
  return response({error:"WORKER_NOT_CONFIGURED"},503);
 if(!authorized(req,secret))return response({error:"UNAUTHORIZED"},401);
 const length=req.headers.get("content-length");
 if(length&&(!/^\d+$/.test(length)||Number(length)>2048))
  return response({error:"INVALID_REQUEST_SIZE"},413);
 let body:unknown;
 try{
  const raw=await req.text();
  if(Buffer.byteLength(raw)>2048)return response({error:"INVALID_REQUEST_SIZE"},413);
  body=JSON.parse(raw);
 }catch{return response({error:"INVALID_JSON"},400)}
 const intakeId=(body&&typeof body==="object"&&"intakeId" in body)?(body as {intakeId:unknown}).intakeId:null;
 if(typeof intakeId!=="string"||!UUID.test(intakeId))return response({error:"INVALID_INTAKE_ID"},400);
 try{
  const job=await claimPaidJob(intakeId);
  return job?response({status:"CLAIMED",job},200):response({status:"NOT_CLAIMABLE"},409);
 }catch{
  return response({error:"WORKER_LEDGER_UNAVAILABLE"},503);
 }
}
