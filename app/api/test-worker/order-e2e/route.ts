import {NextRequest,NextResponse} from 'next/server';
import {createHash,timingSafeEqual,randomUUID} from 'node:crypto';
import {Pool,PoolClient} from 'pg';
import {put,get,head,del,list} from '@vercel/blob';
import {previewBlobOptions} from '../../../../lib/preview-runtime-evidence';
import {claimPaidJob,markResultReady,markDelivered,flagForReview,reserveDelivery} from '../../../../lib/paid-job-claim';
import {previewAuthEnvironment,previewOrderEnvironment,fixtureMatches,ORDER_FIXTURES,TEST_RECIPIENT,syntheticInvoicePdf,isPreviewFixtureCase,isFreshPreviewFixture,isRecoveryPreviewFixture,isOutboxPreviewFixture} from '../../../../lib/preview-order-fixture';
import {requireV2OutboxSchema,publishV2Result,claimV2Outbox,completeV2Outbox,recoverV2Outbox,failV2OutboxBeforeSend,inspectV2Outbox} from '../../../../lib/v2-delivery-outbox';
import {MOCK_DELIVERY_CASE,mockReceiptMatches} from '../../../../lib/preview-mock-delivery';
import {isIsolatedNeonEndpoint,PREVIEW_NEON_BRANCH,PREVIEW_NEON_PROJECT} from '../../../../lib/test-worker-guards';
import {recoverPreviewFailure} from '../../../../lib/preview-order-recovery';
import {previewResumePOST} from '../../../../lib/isolated-delivery-acceptance';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const MAX_BODY=1500000;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
const ACTIONS=['auth_check','status','prepare','claim','source','result','delivered','review','recover','cleanup','reserve_delivery','outbox_enqueue','outbox_claim','outbox_fail','outbox_recover','mock_receipt'];
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
 if(req.headers.get('x-timeease-preview-resume')==='v1')return previewResumePOST(req);
 const env=process.env;
 if(!previewAuthEnvironment(env,new URL(req.url).hostname))return reply({error:'PREVIEW_TEST_ONLY'},404);
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
 // All order actions retain the stricter ledger-disabled fixture boundary.
 if(!previewOrderEnvironment(env,new URL(req.url).hostname))return reply({error:'PREVIEW_TEST_ONLY'},404);
 const {action}=body,kind=body.case??'delivery';
 if(!isPreviewFixtureCase(kind))return reply({error:'INVALID_FIXTURE'},400);
 const outboxCase=isOutboxPreviewFixture(kind);
 if(action==='mock_receipt'&&kind!==MOCK_DELIVERY_CASE)return reply({error:'EXACT_MOCK_FIXTURE_REQUIRED'},400);
 if(outboxCase&&!['status','prepare','claim','source','result','outbox_enqueue','outbox_claim','outbox_fail','outbox_recover','mock_receipt'].includes(action))
  return reply({error:'OUTBOX_NO_EMAIL_ACCEPTANCE_ONLY'},400);
 if(action.startsWith('outbox_')&&!outboxCase)return reply({error:'OUTBOX_FIXTURE_REQUIRED'},400);
 if(action==='outbox_recover'&&kind!=='outbox_timeout')return reply({error:'OUTBOX_TIMEOUT_FIXTURE_REQUIRED'},400);
 if(action==='outbox_fail'&&kind==='outbox_timeout')return reply({error:'OUTBOX_KNOWN_FAILURE_FIXTURE_REQUIRED'},400);
 // New fixtures are no-email / no-cleanup acceptance only. Old cases are unchanged.
 if(isFreshPreviewFixture(kind)&&['delivered','cleanup'].includes(action))return reply({error:'NEW_FIXTURE_NO_DELIVERY_OR_CLEANUP'},400);
 if(isFreshPreviewFixture(kind)&&action==='result'&&kind!=='reservation')return reply({error:'RESERVATION_FIXTURE_REQUIRED'},400);
 if(action==='reserve_delivery'&&kind!=='reservation')return reply({error:'RESERVATION_FIXTURE_REQUIRED'},400);
 if(action==='recover'&&!isRecoveryPreviewFixture(ORDER_FIXTURES[kind]))return reply({error:'FAILURE_FIXTURE_REQUIRED'},400);
 const keys=action==='mock_receipt'?['action','case','deliveryId','messageId']:action==='result'?['action','case','xlsxBase64']:action==='delivered'?['action','case','messageId']:['action','case'];
 if(Object.keys(body).some(k=>!keys.includes(k)))return reply({error:'UNEXPECTED_INPUT'},400);
 if(action==='mock_receipt'&&!mockReceiptMatches(body.deliveryId,body.messageId))return reply({error:'SYNTHETIC_BOUND_RECEIPT_REQUIRED'},400);
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
 if(!['postgres:','postgresql:'].includes(url.protocol)||!isIsolatedNeonEndpoint(url.hostname)||
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
  if(who?.role!=='timeease_worker_limited'||who?.database!=='neondb'||who?.project!==PREVIEW_NEON_PROJECT||
   who?.branch!==PREVIEW_NEON_BRANCH||who?.elevated!==false||who?.member!==false||who?.forbidden_write!==false)
   throw Error('ISOLATION_REQUIRED');
  // Read-only preflight; legacy FK targets or missing scoped grants fail before
  // any order transition or Blob mutation. No runtime schema/permission repair.
  if(outboxCase)await requireV2OutboxSchema(client);
  const id=ORDER_FIXTURES[kind],prefix=`intake-v2/${id}/`,resultPath=`results-v2/${id}/consolidated.xlsx`;
  const result=await client.query('SELECT * FROM public.timeease_v2_orders WHERE intake_id=$1 FOR UPDATE',[id]);
  const row=result.rows[0];
  if(!row||!fixtureMatches(row,kind)){await client.query('ROLLBACK');return reply({error:'SYNTHETIC_FIXTURE_REQUIRED'},409);}
  const pdf=syntheticInvoicePdf();
  const manifest=JSON.stringify({id,synthetic:true,service:'invoice',files:[{pathname:prefix+'file-001.pdf',bytes:pdf.length,originalName:'synthetic-test-004.pdf'}]});
  let data:Record<string,unknown>={};let status=200;
  if(action==='status')data={intakeId:id,status:row.status,processingAttempts:row.processing_attempts,
   resultPath:row.result_path,deliveryMessageId:row.delivery_message_id,lastError:row.last_error,
   ...(outboxCase?{delivery:await inspectV2Outbox(id,client),noEmailSent:true}:{})};
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
    if(outboxCase){
     const published=await publishV2Result(id,resultPath,randomUUID(),client);
     if(published==='NOT_READY')throw Error('OUTBOX_RESULT_NOT_READY');
     status=201;data={resultReady:true,readBackVerified:true,outbox:published,noEmailSent:true};
    }else{
     const ok=await markResultReady(id,resultPath,client);status=ok?201:409;data={resultReady:ok,readBackVerified:true};
    }
   }
  }else if(action==='outbox_enqueue'){
   if(row.result_path!==resultPath){status=409;data={error:'OUTBOX_RESULT_NOT_READY'};}
   else{const enqueued=await publishV2Result(id,resultPath,randomUUID(),client);
    status=enqueued==='NOT_READY'?409:200;data={outbox:enqueued,noEmailSent:true,send:false};}
  }else if(action==='outbox_claim'){
   const claimed=await claimV2Outbox(id,client);status=claimed==='CLAIMED'?200:409;
   data={outbox:claimed,send:false,noEmailSent:true};
   if(kind===MOCK_DELIVERY_CASE){
    const pair=await inspectV2Outbox(id,client);
    const lease=(await client.query('SELECT lease_until FROM public.timeease_fulfillment_outbox WHERE intake_id=$1',[id])).rows[0]?.lease_until;
    data={ok:claimed==='CLAIMED',outbox:claimed,send:claimed==='CLAIMED',intakeId:id,deliveryId:pair.ledger?.delivery_id,leaseUntil:lease,mockProviderOnly:true,noEmailSent:true};
   }
  }else if(action==='mock_receipt'){
   const pair=await inspectV2Outbox(id,client);
   if(pair.ledger?.delivery_id!==body.deliveryId){status=409;data={error:'DELIVERY_ID_MISMATCH',send:false};}
   else{const completed=await completeV2Outbox(id,body.messageId as string,client);status=completed==='REJECTED'?409:200;
    data={delivered:completed!=='REJECTED',idempotent:completed==='IDEMPOTENT',deliveryId:body.deliveryId,mockProviderOnly:true,emailSent:false,send:false};}
  }else if(action==='outbox_fail'||action==='outbox_recover'){
   const quarantined=action==='outbox_fail'?await failV2OutboxBeforeSend(id,client):await recoverV2Outbox(id,client);
   status=quarantined?200:409;data={quarantined,noAutoRetry:true,send:false,noEmailSent:true};
  }else if(action==='reserve_delivery'){
   const reservation=await reserveDelivery(id,client);
   status=reservation==='NOT_RESERVABLE'?409:200;
   data={reservation,send:false,noEmailSent:true,outboxVerified:false,
    reviewRequired:reservation==='ALREADY_RESERVED'};
  }else if(action==='delivered'){
   const ok=row.result_path===resultPath&&await markDelivered(id,body.messageId as string,client);
   status=ok?200:409;data={delivered:ok,providerReceiptRequiresExternalVerification:true};
  }else if(action==='review'){
   const ok=await flagForReview(id,'SYNTHETIC_E2E_FAILURE_NO_AUTO_RESEND',client);status=ok?200:409;data={reviewRequired:ok};
  }else if(action==='recover'){
   const ok=row.status==='PROCESSING'&&await recoverPreviewFailure(id,client);
   status=ok?200:409;data={recovered:ok,noAutoRetry:true,noEmailSent:true};
  }else if(action==='cleanup'){
   // A failed/ambiguous prepare can leave objects before claim. Cleanup may also
   // abort this exact pristine fixture; never clear a PROCESSING order or reset it.
   const pristine=row.status==='PAID'&&row.processing_attempts===0&&row.processing_started_at===null&&
    row.result_path===null&&row.delivery_message_id===null;
   if(!pristine&&!['DELIVERED','REVIEW_REQUIRED'].includes(row.status)){status=409;data={error:'FINAL_OR_PRISTINE_STATE_REQUIRED'};}
   else{
    await del([prefix+'file-001.pdf',prefix+'manifest.json',resultPath],options);
    const remaining=await Promise.all([list({...options,prefix,limit:1}),list({...options,prefix:`results-v2/${id}/`,limit:1})]);
    const clean=remaining.every(r=>r.blobs.length===0);status=clean?200:503;data={cleanupVerified:clean,abortedBeforeClaim:pristine};
   }
  }
  await client.query('COMMIT');
  return reply({synthetic:true,productionTokenUsed:false,...data},status);
 }catch(error){
  await client?.query('ROLLBACK').catch(()=>{});
  const code=error instanceof Error&&['ISOLATION_REQUIRED','SYNTHETIC_SOURCE_REQUIRED','RESULT_READBACK_FAILED','OUTBOX_SCHEMA_NOT_READY','OUTBOX_ROLE_NOT_READY'].includes(error.message)?error.message:'SYNTHETIC_E2E_UNAVAILABLE';
  return reply({error:code},503);
 }finally{client?.release();await pool.end().catch(()=>{});}
}

