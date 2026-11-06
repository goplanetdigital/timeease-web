import {createHash,timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {Client} from "pg";
import {workerDatabaseConnection} from "../../../../lib/worker-database";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
/** Preview-only read-only worker database probe. Never reads orders or returns secrets. */
export async function GET(req:NextRequest){
 const env=process.env;
 if(env.VERCEL_ENV!=="preview"||env.TIMEEASE_ISOLATED_TEST_MODE!=="true"||
    env.VERCEL_GIT_COMMIT_REF!=="feature/isolated-worker-diagnostics-20261026"||
    req.nextUrl.hostname!==env.VERCEL_URL)return reply({error:"PREVIEW_ONLY"},404);
 const secret=env.TIMEEASE_V2_WORKER_SECRET;
 if(!secret||secret.length<32)return reply({error:"WORKER_NOT_CONFIGURED"},503);
 const auth=req.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer ")||auth.length<=7||auth.length>519)return reply({error:"UNAUTHORIZED"},401);
 const actual=createHash("sha256").update(auth.slice(7)).digest();
 const expected=createHash("sha256").update(secret).digest();
 if(!timingSafeEqual(actual,expected))return reply({error:"UNAUTHORIZED"},401);
 let connectionString:string;
 try{connectionString=workerDatabaseConnection(env);}
 catch(error){
  const code=error instanceof Error?error.message:"DATABASE_CONFIGURATION_ERROR";
  return reply({ok:false,error:["WORKER_DATABASE_NOT_CONFIGURED","WORKER_DATABASE_PASSWORD_MISSING","WORKER_DATABASE_ROLE_FORBIDDEN"].includes(code)?code:"DATABASE_CONFIGURATION_ERROR",ordersTouched:false},503);
 }
 const client=new Client({connectionString,connectionTimeoutMillis:5000,statement_timeout:5000,query_timeout:5000});
 try{
  await client.connect();
  const result=await client.query("SELECT current_user AS role, current_database() AS database, pg_is_in_recovery() AS replica");
  const row=result.rows[0];
  if(row?.role!=="timeease_worker_limited")return reply({ok:false,error:"UNEXPECTED_DATABASE_ROLE",ordersTouched:false},503);
  return reply({ok:true,environment:"preview",roleVerified:true,connectionVerified:true,ordersTouched:false,emailsSent:false,blobAccessed:false},200);
 }catch(error){
  const message=error instanceof Error?error.message:"";
  const category=/password|authenticat|SASL/i.test(message)?"AUTH":/ssl|tls|certificate/i.test(message)?"TLS":/timeout|timed out/i.test(message)?"TIMEOUT":/connect|network|ECONN|ENET/i.test(message)?"CONNECT":"OTHER";
  return reply({ok:false,error:"DATABASE_CONNECTION_FAILED",category,ordersTouched:false},503);
 }finally{await client.end().catch(()=>{});}
}
