import {NextRequest,NextResponse} from 'next/server';
import {Pool} from 'pg';
import {get} from '@vercel/blob';
import {createHash,timingSafeEqual} from 'node:crypto';
export const runtime='nodejs';
let pool:Pool|undefined;
export async function GET(req:NextRequest){
 const secret=process.env.TIMEEASE_V2_WORKER_SECRET;
 const db=process.env.TIMEEASE_DB_DATABASE_URL;
 const token=process.env.BLOB_READ_WRITE_TOKEN;
 if(!secret||secret.length<32||!db||!token||process.env.TIMEEASE_V2_PAYMENT_LEDGER_ENABLED!=='true')return NextResponse.json({error:'NOT_CONFIGURED'},{status:503});
 const auth=req.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer ')||auth.length>519)return NextResponse.json({error:'UNAUTHORIZED'},{status:401});
 if(!timingSafeEqual(createHash('sha256').update(auth.slice(7)).digest(),createHash('sha256').update(secret).digest()))return NextResponse.json({error:'UNAUTHORIZED'},{status:401});
 const id=new URL(req.url).searchParams.get('intakeId')||'';
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return NextResponse.json({error:'INVALID_ID'},{status:400});
 try{
  pool??=new Pool({connectionString:db,max:3,connectionTimeoutMillis:5000});
  const path='intake-v2/'+id+'/manifest.json';
  const row=await pool.query('SELECT intake_id FROM timeease_v2_orders WHERE intake_id=$1 AND source_manifest_path=$2 AND status=$3',[id,path,'PROCESSING']);
  if(row.rowCount!==1)return NextResponse.json({error:'NOT_CLAIMED'},{status:409});
  const blob=await get(path,{access:'private',token});
  if(!blob?.stream)return NextResponse.json({error:'NOT_FOUND'},{status:404});
  // Enforce the limit while streaming; Content-Length and decoded text length are not trustworthy bounds.
  const reader=blob.stream.getReader();
  const chunks:Buffer[]=[];
  let bytes=0;
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   bytes+=value.byteLength;
   if(bytes>100000){
    await reader.cancel();
    return NextResponse.json({error:'INVALID_MANIFEST'},{status:409});
   }
   chunks.push(Buffer.from(value));
  }
  const raw=Buffer.concat(chunks,bytes).toString('utf8');
  const manifest=JSON.parse(raw);
  if(manifest.id!==id||!Array.isArray(manifest.files)||manifest.files.length<1||manifest.files.length>100)return NextResponse.json({error:'INVALID_MANIFEST'},{status:409});
  const files=manifest.files.map((f:{pathname?:string;bytes?:number;originalName?:string},index:number)=>{
   if(!f.pathname?.startsWith('intake-v2/'+id+'/file-')||f.pathname.includes('..')||!Number.isSafeInteger(f.bytes)||!f.bytes||f.bytes>3145728)throw Error('INVALID_FILE');
   return {index,originalName:String(f.originalName||'file-'+index).slice(0,255),bytes:f.bytes};
  });
  return NextResponse.json({intakeId:id,service:manifest.service,fileCount:files.length,files},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'MANIFEST_UNAVAILABLE'},{status:503});}
}
