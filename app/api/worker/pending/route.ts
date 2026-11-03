import {createHash,timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {Pool} from "pg";
import {workerDatabaseConnection} from "../../../../lib/worker-database";

export const runtime="nodejs";
let pool:Pool|undefined;
function respond(data:unknown,status:number){return NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}})}
/** Authenticated discovery only; this does not claim or process any order. */
export async function GET(req:NextRequest){
 const secret=process.env.TIMEEASE_V2_WORKER_SECRET;
 if(!secret||secret.length<32||process.env.TIMEEASE_V2_PAYMENT_LEDGER_ENABLED!=="true")
  return respond({error:"WORKER_NOT_CONFIGURED"},503);
 const auth=req.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer ")||auth.length<=7||auth.length>519)
  return respond({error:"UNAUTHORIZED"},401);
 const supplied=createHash("sha256").update(auth.slice(7)).digest();
 const expected=createHash("sha256").update(secret).digest();
 if(!timingSafeEqual(supplied,expected))return respond({error:"UNAUTHORIZED"},401);
 const url=new URL(req.url);
 const limitRaw=url.searchParams.get("limit")||"10";
 if(!/^\d{1,2}$/.test(limitRaw)||Number(limitRaw)<1||Number(limitRaw)>25)
  return respond({error:"INVALID_LIMIT"},400);
 let connectionString:string;
 try{connectionString=workerDatabaseConnection();}
 catch(error){return respond({error:error instanceof Error&&error.message==="WORKER_DATABASE_NOT_CONFIGURED"?"DATABASE_NOT_CONFIGURED":"WORKER_DATABASE_ROLE_FORBIDDEN"},503);}
 try{
  pool??=new Pool({connectionString,max:3,connectionTimeoutMillis:5000});
  const result=await pool.query<{intake_id:string}>(
   "SELECT intake_id FROM timeease_v2_orders WHERE status='PAID' AND source_manifest_path = 'intake-v2/' || intake_id::text || '/manifest.json' ORDER BY created_at ASC LIMIT $1",
   [Number(limitRaw)]);
  return respond({intakeIds:result.rows.map(row=>row.intake_id),intakeId:result.rows[0]?.intake_id??null},200);
 }catch{return respond({error:"WORKER_LEDGER_UNAVAILABLE"},503)}
}
