import {productionReleaseBound,acceptingProductionWork} from "../../../../lib/production-release";
import {createHash,timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {withProductionOrder} from "../../../../lib/production-database";
import {recoverV2Outbox} from "../../../../lib/v2-delivery-outbox";
export const runtime="nodejs";
const reply=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
/** Quarantine only. Never re-claim or resend customer email. */
export async function POST(req:NextRequest){
 if(!productionReleaseBound())return NextResponse.json({error:"PRODUCTION_RELEASE_CLOSED"},{status:503,headers:{"Cache-Control":"no-store"}});
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
 if(Object.keys(b).some(k=>k!=="intakeId")||typeof b.intakeId!=="string"||
 !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.intakeId))return reply({error:"EXACT_OUTBOX_INTAKE_REQUIRED"},400);
 try{
  const ok=await withProductionOrder(b.intakeId,(client)=>recoverV2Outbox(b.intakeId as string,client));
  return reply({ok,send:false,noAutoRetry:true},ok?200:409);
 }catch{return reply({error:"RECOVERY_UNAVAILABLE",send:false},503)}
}
