import {createHash,timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {markResultReady} from "../../../../lib/paid-job-claim";

export const runtime="nodejs";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const respond=(data:unknown,status:number)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(req:NextRequest){
 const secret=process.env.TIMEEASE_V2_WORKER_SECRET;
 if(!secret||secret.length<32||process.env.TIMEEASE_V2_PAYMENT_LEDGER_ENABLED!=="true")
  return respond({error:"WORKER_NOT_CONFIGURED"},503);
 const auth=req.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer ")||auth.length>519||auth.length<=7)
  return respond({error:"UNAUTHORIZED"},401);
 const a=createHash("sha256").update(auth.slice(7)).digest();
 const b=createHash("sha256").update(secret).digest();
 if(!timingSafeEqual(a,b))return respond({error:"UNAUTHORIZED"},401);
 const len=req.headers.get("content-length");
 if(len&&(!/^\d+$/.test(len)||Number(len)>4096))return respond({error:"INVALID_REQUEST_SIZE"},413);
 let body:unknown;
 try{
  const raw=await req.text();
  if(Buffer.byteLength(raw)>4096)return respond({error:"INVALID_REQUEST_SIZE"},413);
  body=JSON.parse(raw);
 }catch{return respond({error:"INVALID_JSON"},400)}
 if(!body||typeof body!=="object")return respond({error:"INVALID_REQUEST"},400);
 const input=body as {intakeId?:unknown;resultPath?:unknown};
 if(typeof input.intakeId!=="string"||!UUID.test(input.intakeId)||
 typeof input.resultPath!=="string"||input.resultPath.length>1024||
 !input.resultPath.startsWith("results-v2/"+input.intakeId+"/")||input.resultPath.includes(".."))
  return respond({error:"INVALID_RESULT"},400);
 try{
  const saved=await markResultReady(input.intakeId,input.resultPath);
  return saved?respond({status:"RESULT_RECORDED",delivery:"PENDING"},200):respond({status:"NOT_RECORDABLE"},409);
 }catch{return respond({error:"WORKER_LEDGER_UNAVAILABLE"},503)}
}
