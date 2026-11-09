import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {put,get,del} from '@vercel/blob';
import {previewBlobOptions,previewRuntimeEvidence} from '../../../lib/preview-runtime-evidence';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
/** Manual synthetic QA only, behind the existing Preview Deployment Protection.
 * No caller-controlled paths, invoice data, database writes, payments or email.
 */
export async function POST(req:NextRequest){
 if(process.env.VERCEL_ENV!=='preview')return reply({error:'PREVIEW_REQUIRED'},404);
 const host=process.env.VERCEL_URL;
 if(!host||req.headers.get('origin')!==`https://${host}`||req.headers.get('sec-fetch-site')!=='same-origin')
  return reply({error:'SAME_ORIGIN_REQUIRED'},403);
 const length=req.headers.get('content-length');
 if(!length||!/^\d+$/.test(length)||Number(length)>512||req.headers.get('content-type')!=='application/x-www-form-urlencoded')
  return reply({error:'INVALID_CONFIRMATION'},400);
 if(await req.text()!=='confirm=synthetic-preview-only')return reply({error:'INVALID_CONFIRMATION'},400);
 const readiness=await previewRuntimeEvidence(process.env);
 if(readiness.database.status!=='VERIFIED'||!readiness.blob.readVerified||!readiness.blob.storeMatched)
  return reply({error:'ISOLATION_NOT_VERIFIED',readiness},503);
 const options=await previewBlobOptions(process.env);
 const path=`preview-isolation-check/${randomUUID()}.json`;
 const fixture=JSON.stringify({synthetic:true,purpose:'preview-storage-isolation',nonce:randomUUID()});
 let writeVerified=false,readBackVerified=false,cleanupVerified=false;
 try{
  await put(path,fixture,{...options,access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:false});
  writeVerified=true;
  const blob=await get(path,{...options,access:'private',useCache:false});
  if(!blob?.stream)throw Error('READBACK_MISSING');
  const reader=blob.stream.getReader();let text='';const decoder=new TextDecoder();
  while(true){const {done,value}=await reader.read();if(done)break;text+=decoder.decode(value,{stream:true});if(text.length>512){await reader.cancel();throw Error('READBACK_TOO_LARGE');}}
  text+=decoder.decode();readBackVerified=text===fixture;
 }catch{/* Only return booleans; never expose provider credentials or object URLs. */}
 finally{if(writeVerified){try{await del(path,options);cleanupVerified=true;}catch{}}}
 const passed=writeVerified&&readBackVerified&&cleanupVerified;
 return reply({isolated:passed,synthetic:true,writeVerified,readBackVerified,cleanupVerified,productionTokenUsed:false},passed?200:503);
}
