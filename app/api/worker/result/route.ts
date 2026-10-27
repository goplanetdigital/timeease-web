import {blobAccessConfigured,blobAccessOptions} from "../../../../lib/blob-access";
import {previewBlobAccessBlocked} from "../../../../lib/preview-blob-guard";
import {createHash,timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {put} from "@vercel/blob";
import {Pool} from "pg";
export const runtime="nodejs";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX=20*1024*1024;
let pool:Pool|undefined;
const respond=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
/** Worker-only result upload. Caller must claim a paid order before storing output. */
export async function POST(req:NextRequest){
 if(previewBlobAccessBlocked(process.env))return NextResponse.json({error:"PREVIEW_BLOB_ISOLATION_REQUIRED"},{status:503,headers:{"Cache-Control":"no-store"}});
 const secret=process.env.TIMEEASE_V2_WORKER_SECRET;
 const dbUrl=process.env.TIMEEASE_DB_DATABASE_URL;
 const storageConfigured=blobAccessConfigured(process.env);
 if(!secret||secret.length<32||!dbUrl||!storageConfigured||process.env.TIMEEASE_V2_PAYMENT_LEDGER_ENABLED!=="true")
  return respond({error:"WORKER_NOT_CONFIGURED"},503);
 const auth=req.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer ")||auth.length>519)return respond({error:"UNAUTHORIZED"},401);
 if(!timingSafeEqual(createHash("sha256").update(auth.slice(7)).digest(),createHash("sha256").update(secret).digest()))
  return respond({error:"UNAUTHORIZED"},401);
 const intakeId=req.headers.get("x-timeease-intake-id")||"";
 if(!UUID.test(intakeId))return respond({error:"INVALID_INTAKE_ID"},400);
 const length=req.headers.get("content-length");
 if(length!==null&&(!/^[0-9]+$/.test(length)||Number(length)<1||Number(length)>MAX))
  return respond({error:"INVALID_RESULT_SIZE"},413);
 const contentType=req.headers.get("content-type")||"";
 if(contentType!=="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  return respond({error:"INVALID_RESULT_TYPE"},415);
 try{
  const blobOptions=await blobAccessOptions(process.env);
  pool??=new Pool({connectionString:dbUrl,max:3,connectionTimeoutMillis:5000});
  const rows=await pool.query("SELECT intake_id FROM timeease_v2_orders WHERE intake_id=$1 AND status='PROCESSING' AND result_path IS NULL",[intakeId]);
  if(rows.rowCount!==1)return respond({error:"JOB_NOT_READY_FOR_RESULT"},409);
  const chunks:Buffer[]=[];
  let received=0;
  if(!req.body)return respond({error:"INVALID_XLSX_BYTES"},422);
  const reader=req.body.getReader();
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   received+=value.byteLength;
   if(received>MAX){await reader.cancel();return respond({error:"INVALID_RESULT_SIZE"},413);}
   chunks.push(Buffer.from(value));
  }
  const bytes=Buffer.concat(chunks,received);
  if((length!==null&&bytes.length!==Number(length))||bytes.length<4||
     bytes.subarray(0,2).toString("hex")!=="504b")
   return respond({error:"INVALID_XLSX_BYTES"},422);
  const pathname="results-v2/"+intakeId+"/consolidated.xlsx";
  await put(pathname,bytes,{access:"private",...blobOptions,contentType,addRandomSuffix:false,allowOverwrite:false});
  return respond({ok:true,resultPath:pathname,bytes:bytes.length},201);
 }catch{return respond({error:"RESULT_UPLOAD_UNAVAILABLE"},503)}
}
