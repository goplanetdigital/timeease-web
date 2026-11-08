import {NextRequest,NextResponse} from 'next/server';
import {createHash,timingSafeEqual} from 'node:crypto';
import {Pool} from 'pg';
import {get} from '@vercel/blob';
import {productionSendEnabled} from '../../../../lib/production-release';
import {productionConnection,verifyProductionPool} from '../../../../lib/production-database';
import {blobAccessConfigured,blobAccessOptions} from '../../../../lib/blob-access';
import {previewBlobAccessBlocked} from '../../../../lib/preview-blob-guard';
import {persistedDeliveryArtifact,XLSX_TYPE} from '../../../../lib/persisted-delivery-artifact';
export const runtime='nodejs';
export const dynamic='force-dynamic';
let pool:Pool|undefined;
const reply=(error:string,status:number)=>NextResponse.json({error,send:false},{status,headers:{'Cache-Control':'no-store'}});
/** Fetch an existing unsent attachment. Never claims, uploads, retries or sends. */
export async function GET(req:NextRequest){
 if(!productionSendEnabled())return reply('PRODUCTION_RELEASE_CLOSED',503);
 if(previewBlobAccessBlocked(process.env)||!blobAccessConfigured(process.env))return reply('STORAGE_NOT_CONFIGURED',503);
 const secret=process.env.TIMEEASE_V2_WORKER_SECRET,auth=req.headers.get('authorization')||'';
 if(!secret||secret.length<32)return reply('WORKER_NOT_CONFIGURED',503);
 if(!auth.startsWith('Bearer ')||auth.length<=7||auth.length>519||
  !timingSafeEqual(createHash('sha256').update(auth.slice(7)).digest(),createHash('sha256').update(secret).digest()))return reply('UNAUTHORIZED',401);
 const q=new URL(req.url).searchParams,id=q.get('intakeId')||'';
 if([...q.keys()].some(k=>k!=='intakeId')||q.getAll('intakeId').length!==1||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return reply('EXACT_DELIVERY_ID_REQUIRED',400);
 try{
  pool??=new Pool({connectionString:productionConnection('worker'),max:2,connectionTimeoutMillis:4000,statement_timeout:5000});
  await verifyProductionPool(pool);
  const options=await blobAccessOptions(process.env);
  const artifact=await persistedDeliveryArtifact(id,pool,async path=>{
   const blob=await get(path,{access:'private',...options,useCache:false});
   return blob?.statusCode===200?{stream:blob.stream,...blob.blob}:null;
  });
  if(!artifact)return reply('PERSISTED_DELIVERY_NOT_READY',409);
  return new NextResponse(artifact.stream,{headers:{'Content-Type':XLSX_TYPE,'Cache-Control':'private, no-store',
   'Content-Disposition':'attachment; filename="consolidated.xlsx"',
   'X-TimeEase-Artifact-Context':Buffer.from(JSON.stringify(artifact.context)).toString('base64url')}});
 }catch{return reply('PERSISTED_DELIVERY_UNAVAILABLE',503);}
}
