import {createHash,timingSafeEqual} from "node:crypto";
import {get} from "@vercel/blob";
import {NextRequest,NextResponse} from "next/server";
import {Pool} from "pg";
export const runtime="nodejs";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const respond=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
let pool:Pool|undefined;
/** Private worker can fetch source bytes only for a paid, claimed order. */
export async function GET(req:NextRequest){
 const secret=process.env.TIMEEASE_V2_WORKER_SECRET;
 const dbUrl=process.env.TIMEEASE_DB_DATABASE_URL;
 const token=process.env.BLOB_READ_WRITE_TOKEN;
 if(!secret||secret.length<32||!dbUrl||!token||process.env.TIMEEASE_V2_PAYMENT_LEDGER_ENABLED!=="true")
  return respond({error:"WORKER_NOT_CONFIGURED"},503);
 const auth=req.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer ")||auth.length>519)return respond({error:"UNAUTHORIZED"},401);
 const a=createHash("sha256").update(auth.slice(7)).digest();
 const b=createHash("sha256").update(secret).digest();
 if(!timingSafeEqual(a,b))return respond({error:"UNAUTHORIZED"},401);
 const url=new URL(req.url);
 const intakeId=url.searchParams.get("intakeId")||"";
 const index=Number(url.searchParams.get("index"));
 if(!ID.test(intakeId)||!Number.isInteger(index)||index<0||index>99)
  return respond({error:"INVALID_SOURCE_REFERENCE"},400);
 try{
  pool??=new Pool({connectionString:dbUrl,max:3,connectionTimeoutMillis:5000});
  const result=await pool.query<{source_manifest_path:string}>(
   "SELECT source_manifest_path FROM timeease_v2_orders WHERE intake_id=$1 AND status='PROCESSING'",
   [intakeId]);
  const path="intake-v2/"+intakeId+"/manifest.json";
  if(result.rowCount!==1||result.rows[0].source_manifest_path!==path)
   return respond({error:"PAID_JOB_NOT_CLAIMED"},409);
  const blob=await get(path,{access:"private",token});
  if(!blob?.stream)return respond({error:"MANIFEST_NOT_FOUND"},404);
  const manifestBytes=Buffer.from(await new Response(blob.stream).arrayBuffer());
  if(manifestBytes.length>100000)return respond({error:"INVALID_MANIFEST"},409);
  const raw=manifestBytes.toString("utf8");
  const manifest=JSON.parse(raw) as {id?:string;files?:Array<{pathname?:string;bytes?:number}>};
  const file=manifest.files?.[index];
  if(manifest.id!==intakeId||!Array.isArray(manifest.files)||manifest.files.length>100||!file||
   typeof file.pathname!=="string"||!file.pathname.startsWith("intake-v2/"+intakeId+"/file-")||
   file.pathname.includes("..")||!Number.isSafeInteger(file.bytes)||!file.bytes||file.bytes>3145728)
   return respond({error:"INVALID_SOURCE_MANIFEST"},409);
  const source=await get(file.pathname,{access:"private",token});
  if(!source?.stream)return respond({error:"SOURCE_NOT_FOUND"},404);
  if(typeof source.blob.size==="number"&&source.size!==file.bytes)return respond({error:"SOURCE_SIZE_MISMATCH"},409);
  const bytes=Buffer.from(await new Response(source.stream).arrayBuffer());
  if(bytes.length!==file.bytes)return respond({error:"SOURCE_SIZE_MISMATCH"},409);
  return new NextResponse(bytes,{status:200,headers:{"Content-Type":"application/octet-stream",
   "Cache-Control":"no-store","X-TimeEase-File-Count":String(manifest.files.length)}});
 }catch{return respond({error:"SOURCE_UNAVAILABLE"},503)}
}
