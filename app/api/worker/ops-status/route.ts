import {createHash,timingSafeEqual} from "node:crypto";
import {Pool} from "pg";
import {NextRequest,NextResponse} from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function authorized(req:NextRequest,secret:string):boolean{
 const header=req.headers.get("authorization")||"";
 if(!header.startsWith("Bearer "))return false;
 const token=header.slice(7);
 if(!token||token.length>512)return false;
 const actual=createHash("sha256").update(token).digest();
 const expected=createHash("sha256").update(secret).digest();
 return timingSafeEqual(actual,expected);
}
function reply(body:unknown,status=200){
 return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
}

/** Private, read-only operational view; never expose order IDs or customer data. */
export async function GET(req:NextRequest){
 const secret=process.env.TIMEEASE_V2_WORKER_SECRET;
 if(!secret||secret.length<32)return reply({error:"NOT_CONFIGURED"},503);
 if(!authorized(req,secret))return reply({error:"UNAUTHORIZED"},401);
 const connectionString=process.env.TIMEEASE_DB_DATABASE_URL;
 if(!connectionString)return reply({error:"LEDGER_NOT_CONFIGURED"},503);
 const pool=new Pool({connectionString,max:1,connectionTimeoutMillis:3500,idleTimeoutMillis:1000});
 try{
  const result=await pool.query<{status:string;count:string}>(
   "SELECT status,COUNT(*)::text AS count FROM public.timeease_v2_orders GROUP BY status"
  );
  const counts:Record<string,number>=Object.create(null);
  for(const row of result.rows)counts[row.status]=Number(row.count);
  return reply({
   ledgerReachable:true,
   ledgerEnabled:process.env.TIMEEASE_V2_PAYMENT_LEDGER_ENABLED==="true",
   checkoutEnabled:process.env.TIMEEASE_V2_CHECKOUT_ENABLED==="true",
   deliveryVerified:process.env.TIMEEASE_V2_DELIVERY_VERIFIED==="true",
   counts
  });
 }catch{
  return reply({error:"LEDGER_QUERY_FAILED"},503);
 }finally{
  await pool.end().catch(()=>{});
 }
}
