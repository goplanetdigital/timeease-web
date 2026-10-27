import {NextRequest,NextResponse} from 'next/server';
import {createHash,timingSafeEqual} from 'node:crypto';
import {Pool,PoolClient} from 'pg';
import {put,get,head,del,list} from '@vercel/blob';
import {previewBlobOptions} from '../../../../lib/preview-runtime-evidence';
import {claimPaidJob,markResultReady,markDelivered,flagForReview} from '../../../../lib/paid-job-claim';
import {previewOrderEnvironment,fixtureMatches,ORDER_FIXTURES,TEST_RECIPIENT,syntheticInvoicePdf} from '../../../../lib/preview-order-fixture';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const MAX_BODY=1500000;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
const ACTIONS=['auth_check','status','prepare','claim','source','result','delivered','review','cleanup'];
/** Diagnostic only: no DB, Blob, payment or email side effects; POST remains authenticated. */
export async function GET(req:NextRequest){
 if(!previewOrderEnvironment(process.env,new URL(req.url).hostname))return reply({error:'PREVIEW_TEST_ONLY'},404);
 return reply({environment:process.env.VERCEL_ENV,branch:process.env.VERCEL_GIT_COMMIT_REF,
  commit:process.env.VERCEL_GIT_COMMIT_SHA,deploymentHost:process.env.VERCEL_URL,
  syntheticOnly:true,postAuthentication:'existing-test-worker-bearer-and-deployment-protection',
  customerRoutesBlocked:true,paymentEnabled:false,emailSentByThisEndpoint:false,actions:ACTIONS});
}
async function bytes(stream:ReadableStream<Uint8Array>,limit:number){
 const reader=stream.getReader();const chunks:Buffer[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
  if(size>limit)throw Error('SIZE_LIMIT');chunks.push(Buffer.from(value));}
  return Buffer.concat(chunks,size);
 }finally{await reader.cancel().catch(()=>{});}
}
/** Test-only adapter. No INSERT, payment, email or caller-selected order/path/recipient.
 * Locks the exact fixture row while reusing the real state transitions on the same client.
 * A reviewable fixture must be inserted separately; Worker permissions are unchanged.
 */
export async function POST(req:NextRequest){
 const env=process.env;
 if(!previewOrderEnvironment(env,new URL(req.url).hostname))return reply({error:'PREVIEW_TEST_ONLY'},404);
 const secret=env.TIMEEASE_TEST_WORKER_SECRET,auth=req.headers.get('authorization')||'';
 if(!secret||secret.length<32)return reply({error:'TEST_AUTH_MISSING'},503);
 if(!auth.startsWith('Bearer ')||auth.length<=7||auth.length>519||
  !timingSafeEqual(createHash('sha256').update(auth.slice(7)).digest(),createHash('sha256').update(secret).digest()))
  return reply({error:'UNAUTHORIZED'},401);
 if(req.headers.get('content-type')!=='application/json')return reply({error:'JSON_REQUIRED'},415);
 const length=req.headers.get('content-length');
 if(length&&(!/^\d+$/.test(length)||Number(length)>MAX_BODY))return reply({error:'REQUEST_TOO_LARGE'},413);
 let body:Record<string,unknown>;
 try{if(!req.body)throw Error();body=JSON.parse((await bytes(req.body,MAX_BODY)).toString('utf8'));}
 catch{return reply({error:'INVALID_BODY'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.action!=='string'||!ACTIONS.includes(body.action))
  return reply({error:'INVALID_ACTION'},400);
 // Authentication-only phase: exit before parsing a DB URL, constructing a Pool,
 // obtaining Blob credentials, querying orders or invoking any Worker transition.
 if(body.action==='auth_check'){
  if(Object.keys(body).some(k=>!['action','nonce'].includes(k))||typeof body.nonce!=='string'||
   !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.nonce))
   return reply({error:'INVALID_AUTH_PROBE'},400);
  return reply({authenticated:true,scope:'auth-check-only',environment:env.VERCEL_ENV,
   branch:env.VERCEL_GIT_COMMIT_REF,commit:env.VERCEL_GIT_COMMIT_SHA,
   deploymentHost:env.VERCEL_URL,requestNonce:body.nonce,databaseAccessed:false,
   blobAccessed:false,ordersTouched:false,emailSent:false});
 }
 const {action}=body,kind=body.case??'delivery';
 if(kind!=='delivery'&&kind!=='failure')return reply({error:'INVALID_FIXTURE'},400);
 const keys=action==='result'?['action','case','xlsxBase64']:action==='delivered'?['action','case','messageId']:['action','case'];
 if(Object.keys(body).some(k=>!keys.includes(k)))return reply({error:'UNEXPECTED_INPUT'},400);
 let workbook:Buffer|undefined;
 if(action==='result'){
  if(typeof body.xlsxBase64!=='string'||!body.xlsxBase64||body.xlsxBase64.length>1400000)return reply({error:'INVALID_XLSX'},400);
  workbook=Buffer.from(body.xlsxBase64,'base64');
  if(workbook.length<4||workbook.toString('base64')!==body.xlsxBase64||workbook.subarray(0,4).toString('hex')!=='504b0304')
   return reply({error:'INVALID_XLSX'},400);
 }
 if(action==='delivered'&&(typeof body.messageId!=='string'||!/^[a-f0-9]{10,64}$/i.test(body.messageId)))
  return reply({error:'INVALID_TEST_GMAIL_RECEIPT'},400);
 let url:URL;
 try{url=new URL(env.TIMEEASE_DB_DATABASE_URL||'');}catch{return reply({error:'TEST_DATABASE_INVALID'},503);}
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!=='ep-summer-salad-aoeax66z.c-2.ap-southeast-1.aws.neon.tech'||
  url.username!=='timeease_worker_limited'||url.pathname!=='/neondb')return reply({error:'TEST_DATABASE_IDENTITY_REQUIRED'},503);
 url.searchParams.set('sslmode','verify-full');
 const pool=new Pool({connectionString:url.toString(),max:1,connectionTimeoutMillis:4000,statement_timeout:5000});
 let client:PoolClient|undefined;
 try{
  // OIDC + explicit independent Store only. No inherited read-write token option.
  const options=await previewBlobOptions(env);
  client=await pool.connect();
  const tls=client.connection.stream as unknown as {encrypted?:boolean;authorized?:boolean;getProtocol?:()=>string|null};
  if(tls.encrypted!==true||tls.authorized!==true||!['TLSv1.2','TLSv1.3'].includes(tls.getProtocol?.()||''))throw Error('ISOLATION_REQUIRED');
  await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='3s'");
  const identity=await client.query(`SELECT current_user AS role,current_database() AS database,
   current_setting('neon.project_id',true) AS project,current_setting('neon.branch_id',true) AS branch,
   (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolreplication FROM pg_roles WHERE rolname=current_user) AS elevated,
   pg_has_role(current_user,'neon_superuser','MEMBER') AS member,
   has_table_privilege(current_user,'public.timeease_v2_orders','INSERT') OR has_table_privilege(current_user,'public.timeease_v2_orders','DELETE') OR has_table_privilege(current_user,'public.timeease_v2_orders','TRUNCATE') AS forbidden_write`);
  const who=identity.rows[0];
  if(who?.role!=='timeease_worker_limited'||who?.database!=='neondb'||who?.project!=='odd-base-63790740'||
   who?.branch!=='br-rough-butterfly-aox5mukp'||who?.elevated!==false||who?.member!==false||who?.forbidden_write!==false)
   throw Error('ISOLATION_REQUIRED');
  const id=ORDER_FIXTURES[kind],prefix=`intake-v2/${id}/`,resultPath=`results-v2/${id}/consolidated.xlsx`;
  const result=await client.query('SELECT * FROM public.timeease_v2_orders WHERE intake_id=$1 FOR UPDATE',[id]);
  const row=result.rows[0];
  if(!row||!fixtureMatches(row,kind)){await client.query('ROLLBACK');return reply({error:'SYNTHETIC_FIXTURE_REQUIRED'},409);}
  const pdf=syntheticInvoicePdf();
  const manifest=JSON.stringify({id,synthetic:true,service:'invoice',files:[{pathname:prefix+'file-001.pdf',bytes:pdf.length,originalName:'synthetic-test-004.pdf'}]});
  let data:Record<string,unknown>={};let status=200;
  if(action==='status')data={intakeId:id,status:row.status,processingAttempts:row.processing_attempts,
   resultPath:row.result_path,deliveryMessageId:row.delivery_message_id,lastError:row.last_error};
  else if(action==='prepare'){
   if(row.status!=='PAID'||row.processing_attempts!==0){status=409;data={error:'FIXTURE_NOT_FRESH'};}
   else{
    const written:string[]=[];
    try{
     await put(prefix+'file-001.pdf',pdf,{...options,access:'private',contentType:'application/pdf',addRandomSuffix:false,allowOverwrite:false});written.push(prefix+'file-001.pdf');
     await put(prefix+'manifest.json',manifest,{...options,access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:false});
    }catch(error){if(written.length)await del(written,options).catch(()=>{});throw error;}
    data={prepared:true,intakeId:id};
   }
  }else if(action==='claim'||action==='source'){
   if(action==='source'&&row.status!=='PROCESSING'){status=409;data={error:'NOT_CLAIMED'};}
   else if(action==='claim'&&row.status!=='PAID'){status=409;data={error:'NOT_CLAIMABLE'};}
   else{
    const source=await get(prefix+'file-001.pdf',{...options,access:'private',useCache:false});
    const storedManifest=await get(prefix+'manifest.json',{...options,access:'private',useCache:false});
    if(!source?.stream||!storedManifest?.stream||!(await bytes(source.stream,pdf.length)).equals(pdf)||
     (await bytes(storedManifest.stream,4096)).toString('utf8')!==manifest)throw Error('SYNTHETIC_SOURCE_REQUIRED');
    if(action==='source')data={intakeId:id,pdfBase64:pdf.toString('base64'),recipient:TEST_RECIPIENT};
    else{const job=await claimPaidJob(id,client);status=job?200:409;data=job?{status:'CLAIMED',job}:{error:'NOT_CLAIMABLE'};}
   }
  }else if(action==='result'){
   if(row.status!=='PROCESSING'||row.result_path){status=409;data={error:'NOT_READY_FOR_RESULT'};}
   else{
    await put(resultPath,workbook!,{...options,access:'private',contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',addRandomSuffix:false,allowOverwrite:false});
    const stored=await head(resultPath,options);
    const readback=await get(resultPath,{...options,access:'private',useCache:false});
    if(stored.size!==workbook!.length||!readback?.stream||!(await bytes(readback.stream,workbook!.length)).equals(workbook!))throw Error('RESULT_READBACK_FAILED');
    const ok=await markResultReady(id,resultPath,client);status=ok?201:409;data={resultReady:ok,readBackVerified:true};
   }
  }else if(action==='delivered'){
   const ok=row.result_path===resultPath&&await markDelivered(id,body.messageId as string,client);
   status=ok?200:409;data={delivered:ok,providerReceiptRequiresExternalVerification:true};
  }else if(action==='review'){
   const ok=await flagForReview(id,'SYNTHETIC_E2E_FAILURE_NO_AUTO_RESEND',client);status=ok?200:409;data={reviewRequired:ok};
  }else if(action==='cleanup'){
   if(!['DELIVERED','REVIEW_REQUIRED'].includes(row.status)){status=409;data={error:'FINAL_STATE_REQUIRED'};}
   else{
    await del([prefix+'file-001.pdf',prefix+'manifest.json',resultPath],options);
    const remaining=await Promise.all([list({...options,prefix,limit:1}),list({...options,prefix:`results-v2/${id}/`,limit:1})]);
    const clean=remaining.every(r=>r.blobs.length===0);status=clean?200:503;data={cleanupVerified:clean};
   }
  }
  await client.query('COMMIT');
  return reply({synthetic:true,productionTokenUsed:false,...data},status);
 }catch(error){
  await client?.query('ROLLBACK').catch(()=>{});
  const code=error instanceof Error&&['ISOLATION_REQUIRED','SYNTHETIC_SOURCE_REQUIRED','RESULT_READBACK_FAILED'].includes(error.message)?error.message:'SYNTHETIC_E2E_UNAVAILABLE';
  return reply({error:code},503);
 }finally{client?.release();await pool.end().catch(()=>{});}
}
