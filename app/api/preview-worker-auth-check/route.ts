import {NextRequest,NextResponse} from 'next/server';
import {POST as workerPost} from '../test-worker/order-e2e/route';
import {previewOrderEnvironment} from '../../../lib/preview-order-fixture';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
/** Operator-only, same-origin authentication probe under existing Vercel Protection.
 * Delegates only auth_check to the original Bearer verifier in this process.
 * Does NOT establish an external GitHub/n8n Worker HTTP transport.
 */
export async function POST(req:NextRequest){
 const env=process.env;
 if(!previewOrderEnvironment(env,new URL(req.url).hostname))return reply({error:'PREVIEW_TEST_ONLY'},404);
 if(req.headers.get('origin')!==`https://${env.VERCEL_URL}`||req.headers.get('sec-fetch-site')!=='same-origin')
  return reply({error:'SAME_ORIGIN_REQUIRED'},403);
 if(req.headers.get('content-type')!=='application/x-www-form-urlencoded')return reply({error:'FORM_REQUIRED'},415);
 const length=req.headers.get('content-length');
 if(length&&(!/^\d+$/.test(length)||Number(length)>256))return reply({error:'INVALID_CONFIRMATION'},400);
 if(!req.body)return reply({error:'INVALID_CONFIRMATION'},400);
 const reader=req.body.getReader();const chunks:Buffer[]=[];let size=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
   if(size>256)return reply({error:'INVALID_CONFIRMATION'},400);chunks.push(Buffer.from(value));}
 }finally{await reader.cancel().catch(()=>{});}
 const form=new URLSearchParams(Buffer.concat(chunks,size).toString('utf8'));
 const nonce=form.get('nonce');
 if([...form.keys()].some(k=>!['confirm','nonce'].includes(k))||form.getAll('confirm').length!==1||form.getAll('nonce').length!==1||
  form.get('confirm')!=='preview-auth-check-only'||!nonce||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nonce))
  return reply({error:'INVALID_CONFIRMATION'},400);
 // Existing Preview binding; never export to Actions, n8n, browser, URLs or logs.
 const secret=env.TIMEEASE_TEST_WORKER_SECRET;
 if(!secret||secret.length<32)return reply({error:'TEST_AUTH_MISSING'},503);
 try{
  const result=await workerPost(new NextRequest(`https://${env.VERCEL_URL}/api/test-worker/order-e2e`,{
   method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`},
   body:JSON.stringify({action:'auth_check',nonce})}));
  if(result.status!==200)return reply({error:'AUTH_PROBE_REJECTED',workerStatus:result.status},503);
  const data=await result.json();
  if(data.authenticated!==true||data.scope!=='auth-check-only'||data.environment!=='preview'||
   data.branch!==env.VERCEL_GIT_COMMIT_REF||data.commit!==env.VERCEL_GIT_COMMIT_SHA||
   data.deploymentHost!==env.VERCEL_URL||data.requestNonce!==nonce||
   data.databaseAccessed!==false||data.blobAccessed!==false||data.ordersTouched!==false||data.emailSent!==false)
   return reply({error:'AUTH_PROBE_UNEXPECTED_RESPONSE'},503);
  // Whitelist output. Never forward arbitrary upstream bodies, errors or headers.
  return reply({authenticated:true,scope:'auth-check-only',environment:'preview',
   branch:data.branch,commit:data.commit,deploymentHost:data.deploymentHost,requestNonce:nonce,
   transport:'protected-browser-post-with-in-process-bearer-verification',externalWorkerHttpVerified:false,
   databaseAccessed:false,blobAccessed:false,ordersTouched:false,emailSent:false},200);
 }catch{return reply({error:'AUTH_PROBE_UNAVAILABLE'},503);}
}
