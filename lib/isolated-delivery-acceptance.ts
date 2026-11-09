import {NextRequest,NextResponse} from 'next/server';
import {Pool,PoolClient} from 'pg';
import {get,put} from '@vercel/blob';
import {createHash,randomUUID} from 'node:crypto';
import {previewOrderEnvironment,syntheticInvoicePdf} from './preview-order-fixture';
import {reversalBearer,reversalSignature} from './preview-shopify-reversal';
import {previewBlobOptions,PREVIEW_BLOB_STORE} from './preview-runtime-evidence';
import {PREVIEW_NEON_BRANCH,PREVIEW_NEON_PROJECT} from './test-worker-guards';
import {persistedDeliveryArtifact,XLSX_TYPE} from './persisted-delivery-artifact';
import {claimPaidJob} from './paid-job-claim';
import {requireV2OutboxSchema,publishV2Result,claimV2Outbox,completeV2Outbox,inspectV2Outbox,failV2OutboxBeforeSend} from './v2-delivery-outbox';
import {mockReceiptMatches} from './preview-mock-delivery';
import {RESUME_PROJECT,RESUME_HOST,RESUME_SHOP,RESUME_FIXTURES,RESUME_XLSX_BASE64,resumeFixture,resumeRowMatches} from './isolated-delivery-fixtures';
import {canonicalPreviewHost,previewAliasCommitMatches} from './isolated-preview-alias';
import {isolatedPaymentConnection} from './isolated-payment-connection';
import {holdShopifyPayment} from './payment-reversal';
import {shopifyPaymentState} from './shopify-payment-state';
const reply=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export function resumeEnvironment(env:NodeJS.ProcessEnv,host:string):boolean{
 return previewOrderEnvironment(env,canonicalPreviewHost(env,host))&&env.VERCEL_PROJECT_ID===RESUME_PROJECT&&
  env.TIMEEASE_PREVIEW_BLOB_STORE_ID===PREVIEW_BLOB_STORE;
}
function entry(req:NextRequest):NextResponse|null{
 if(!resumeEnvironment(process.env,new URL(req.url).hostname))return reply({error:'ISOLATED_PREVIEW_REQUIRED',send:false},404);
 if(!reversalBearer(req.headers.get('authorization')||'',process.env.TIMEEASE_TEST_WORKER_SECRET))return reply({error:'UNAUTHORIZED',send:false},401);
 if(!previewAliasCommitMatches(process.env,new URL(req.url).hostname,req.headers))return reply({error:'PREVIEW_COMMIT_MISMATCH',send:false},409);
 return null;
}
async function connection(readOnly:boolean){
 const url=new URL(process.env.TIMEEASE_DB_DATABASE_URL||'');
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!==RESUME_HOST||url.username!=='timeease_worker_limited'||url.pathname!=='/neondb')throw Error('EXACT_PREVIEW_SCOPE_REQUIRED');
 url.searchParams.set('sslmode','verify-full');
 const pool=new Pool({connectionString:url.toString(),max:1,connectionTimeoutMillis:4000,statement_timeout:5000});
 let c:PoolClient|undefined;
 try{
  c=await pool.connect();
  const tls=c.connection.stream as unknown as {encrypted?:boolean;authorized?:boolean;getProtocol?:()=>string|null};
  if(tls.encrypted!==true||tls.authorized!==true||!['TLSv1.2','TLSv1.3'].includes(tls.getProtocol?.()||''))throw Error('VERIFIED_TLS_REQUIRED');
  await c.query(readOnly?'BEGIN READ ONLY':'BEGIN');
  await c.query("SET LOCAL lock_timeout='3s'");await c.query("SET LOCAL idle_in_transaction_session_timeout='10s'");
  const row=(await c.query(`SELECT current_database() AS database,current_user AS role,
   current_setting('neon.project_id',true) AS project,current_setting('neon.branch_id',true) AS branch,
   (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolreplication FROM pg_roles WHERE rolname=current_user) AS elevated,
   pg_has_role(current_user,'neon_superuser','MEMBER') AS member,
   has_table_privilege(current_user,'public.timeease_v2_orders','INSERT') OR has_table_privilege(current_user,'public.timeease_v2_orders','DELETE') OR has_table_privilege(current_user,'public.timeease_v2_orders','TRUNCATE') AS forbidden`)).rows[0];
  if(row?.database!=='neondb'||row.role!=='timeease_worker_limited'||row.project!==PREVIEW_NEON_PROJECT||row.branch!==PREVIEW_NEON_BRANCH||row.elevated!==false||row.member!==false||row.forbidden!==false)throw Error('EXACT_PREVIEW_IDENTITY_REQUIRED');
  await requireV2OutboxSchema(c);
  return {pool,c};
 }catch(error){await c?.query('ROLLBACK').catch(()=>{});c?.release();await pool.end().catch(()=>{});throw error;}
}
/** Fixed synthetic rows only. Production still executes its unchanged gate. */
export async function previewDeliveryArtifactGET(req:NextRequest){
 const denied=entry(req);if(denied)return denied;
 const q=new URL(req.url).searchParams,id=q.get('intakeId');
 if([...q.keys()].some(k=>k!=='intakeId')||q.getAll('intakeId').length!==1||!resumeFixture(id))return reply({error:'EXACT_RESUME_FIXTURE_REQUIRED',send:false},400);
 let db:Awaited<ReturnType<typeof connection>>|undefined;
 try{
  db=await connection(true);
  const row=(await db.c.query('SELECT * FROM public.timeease_v2_orders WHERE intake_id=$1',[id])).rows[0];
  if(!resumeRowMatches(row,id!))return reply({error:'SYNTHETIC_ROW_BINDING_REQUIRED',send:false},409);
  const options=await previewBlobOptions(process.env);
  const artifact=await persistedDeliveryArtifact(id!,db.c,async path=>{
   const b=await get(path,{...options,access:'private',useCache:false});
   return b?.statusCode===200?{stream:b.stream,...b.blob}:null;
  });
  if(!artifact)return reply({error:'PERSISTED_DELIVERY_NOT_READY',send:false},409);
  return new NextResponse(artifact.stream,{headers:{'Content-Type':XLSX_TYPE,'Cache-Control':'private, no-store',
   'Content-Disposition':'attachment; filename="consolidated.xlsx"','X-TimeEase-Artifact-Context':Buffer.from(JSON.stringify(artifact.context)).toString('base64url'),
   'X-TimeEase-Synthetic-Only':'true','X-TimeEase-Send-Authorized':'false'}});
 }catch{return reply({error:'ISOLATED_ARTIFACT_UNAVAILABLE',send:false},503);}
 finally{await db?.c.query('ROLLBACK').catch(()=>{});db?.c.release();await db?.pool.end().catch(()=>{});}
}
/** Fixture setup/mock receipts only. No caller IDs, SQL INSERT, provider or mail. */
export async function previewResumePOST(req:NextRequest){
 const denied=entry(req);if(denied)return denied;
 if(req.headers.get('content-type')!=='application/json')return reply({error:'JSON_REQUIRED'},415);
 if(!req.body)return reply({error:'INVALID_JSON'},400);
 const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
  if(size>1024)return reply({error:'BODY_TOO_LARGE'},413);chunks.push(part.value);}}
 catch{return reply({error:'INVALID_JSON'},400);}
 finally{await reader.cancel().catch(()=>{});}
 const raw=Buffer.concat(chunks).toString('utf8');
 let b:Record<string,unknown>;try{b=JSON.parse(raw);}catch{return reply({error:'INVALID_JSON'},400);}
 if(!b||typeof b!=='object'||Array.isArray(b)||typeof b.case!=='string'||!Object.prototype.hasOwnProperty.call(RESUME_FIXTURES,b.case)||
  !['stage','status','claim_delivery','mock_receipt','hold','fail_before_send'].includes(String(b.action)))return reply({error:'EXACT_RESUME_ACTION_REQUIRED'},400);
 const id=RESUME_FIXTURES[b.case as keyof typeof RESUME_FIXTURES].id;
 const allowed=b.action==='mock_receipt'?['action','case','deliveryId','messageId']:['action','case'];
 if(Object.keys(b).some(k=>!allowed.includes(k))||(b.action==='mock_receipt'&&(b.case!=='delivery'||!mockReceiptMatches(b.deliveryId,b.messageId))))return reply({error:'FIXED_MOCK_RECEIPT_REQUIRED'},400);
 if(b.action==='fail_before_send'&&b.case!=='failure')return reply({error:'EXACT_FAILURE_FIXTURE_REQUIRED'},400);
 if(b.action==='hold'){
  const topic=b.case==='cancelled'?'orders/cancelled':b.case==='refunded'?'refunds/create':null;
  if(!topic||req.headers.get('x-shopify-topic')!==topic||req.headers.get('x-shopify-shop-domain')!==RESUME_SHOP)return reply({error:'EXACT_HOLD_FIXTURE_REQUIRED'},400);
  if(!reversalSignature(raw,req.headers.get('x-shopify-hmac-sha256')))return reply({error:'INVALID_WEBHOOK_SIGNATURE'},401);
 }
 let db:Awaited<ReturnType<typeof connection>>|undefined;
 try{
  db=b.action==='hold'?await isolatedPaymentConnection(process.env):await connection(false);const c=db.c;
  if(b.action==='hold')await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[RESUME_SHOP+':'+RESUME_FIXTURES[b.case as keyof typeof RESUME_FIXTURES].order]);
  const row=(await c.query('SELECT * FROM public.timeease_v2_orders WHERE intake_id=$1 FOR UPDATE',[id])).rows[0];
  if(!resumeRowMatches(row,id))return reply({error:'SYNTHETIC_ROW_BINDING_REQUIRED',send:false},409);
  let data:Record<string,unknown>={};let status=200;
  if(b.action==='stage'){
   if(row.status!=='PAID'||row.processing_attempts!==0||row.result_path||row.delivery_message_id||row.last_error)return reply({error:'FRESH_FIXTURE_REQUIRED',send:false},409);
   const held=await c.query('SELECT 1 FROM public.timeease_payment_holds WHERE shop_domain=$1 AND shopify_order_id=$2',[row.shopify_shop_domain,row.shopify_order_id]);
   if(held.rowCount!==0)return reply({error:'PAYMENT_HELD',send:false},409);
   const options=await previewBlobOptions(process.env),pdf=syntheticInvoicePdf(),prefix=`intake-v2/${id}/`,path=`results-v2/${id}/consolidated.xlsx`;
   const file=Buffer.from(RESUME_XLSX_BASE64,'base64');
   await put(prefix+'file-001.pdf',pdf,{...options,access:'private',contentType:'application/pdf',addRandomSuffix:false,allowOverwrite:false});
   await put(prefix+'manifest.json',JSON.stringify({id,synthetic:true,service:'invoice',files:[{pathname:prefix+'file-001.pdf',bytes:pdf.length,originalName:'synthetic-resume.pdf'}]}),{...options,access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:false});
   await put(path,file,{...options,access:'private',contentType:XLSX_TYPE,addRandomSuffix:false,allowOverwrite:false});
   if(!await claimPaidJob(id,c))throw Error('CLAIM_FAILED');
   const outbox=await publishV2Result(id,path,randomUUID(),c);if(outbox!=='ENQUEUED')throw Error('PUBLISH_FAILED');
   data={staged:true,intakeId:id,outbox,bytes:file.length,sha256:createHash('sha256').update(file).digest('hex')};
  }else if(b.action==='hold'){
   if(row.status!=='PROCESSING'||row.processing_attempts!==1||row.delivery_message_id||row.result_path!==`results-v2/${id}/consolidated.xlsx`)return reply({error:'FRESH_STAGED_HOLD_REQUIRED'},409);
   const topic=b.case==='cancelled'?'orders/cancelled':'refunds/create';
   const state=shopifyPaymentState(topic,topic==='refunds/create'?{order_id:row.shopify_order_id}:{id:row.shopify_order_id,test:false});
   if(state.kind!=='HOLD')throw Error('HOLD_MAPPING_REQUIRED');
   const held=await holdShopifyPayment(state.orderId,RESUME_SHOP,state.reason,c);
   if(held!=='HELD')throw Error('HOLD_NOT_COMMITTED');
   data={held:true,intakeId:id,reason:state.reason,signatureVerified:true,signingScope:'PUBLIC_SYNTHETIC_FIXTURE',role:'timeease_payment_limited'};
  }else if(b.action==='fail_before_send'){
   const ok=await failV2OutboxBeforeSend(id,c);status=ok?200:409;data={quarantined:ok,noAutoRetry:true};
  }else if(b.action==='status')data={intakeId:id,status:row.status,attempts:row.processing_attempts,delivery:await inspectV2Outbox(id,c)};
  else if(b.action==='claim_delivery'){
   const claim=await claimV2Outbox(id,c),pair=await inspectV2Outbox(id,c);status=claim==='CLAIMED'?200:409;
   data={outbox:claim,intakeId:id,deliveryId:pair.ledger?.delivery_id,mockProviderOnly:true,
    mockMessageId:pair.ledger?createHash('sha256').update('mock-provider:'+pair.ledger.delivery_id).digest('hex'):null};
  }else{
   const pair=await inspectV2Outbox(id,c);if(pair.ledger?.delivery_id!==b.deliveryId)return reply({error:'DELIVERY_ID_MISMATCH',send:false},409);
   const done=await completeV2Outbox(id,b.messageId as string,c);status=done==='REJECTED'?409:200;
   data={completed:done!=='REJECTED',idempotent:done==='IDEMPOTENT',mockProviderOnly:true};
  }
  await c.query('COMMIT');return reply({syntheticOnly:true,emailSent:false,send:false,...data},status);
 }catch{return reply({error:'ISOLATED_RESUME_UNAVAILABLE',send:false},503);}
 finally{await db?.c.query('ROLLBACK').catch(()=>{});db?.c.release();await db?.pool.end().catch(()=>{});}
}
