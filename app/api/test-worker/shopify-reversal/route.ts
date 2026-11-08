import {NextRequest,NextResponse} from 'next/server';
import {Pool,PoolClient} from 'pg';
import {REVERSAL_FIXTURES,REVERSAL_LOGIN,reversalPayload,reversalEnvironment,reversalBearer,reversalSignature} from '../../../../lib/preview-shopify-reversal';
import {shopifyPaymentState} from '../../../../lib/shopify-payment-state';
import {holdShopifyPayment} from '../../../../lib/payment-reversal';
import {PREVIEW_NEON_BRANCH,PREVIEW_NEON_PROJECT,isIsolatedNeonEndpoint} from '../../../../lib/test-worker-guards';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
// Dedicated two-ID test adapter: no Blob, sender, Worker, payment creation or DDL.
export async function POST(req:NextRequest){
 const env=process.env;
 if(!reversalEnvironment(env,new URL(req.url).hostname))return reply({error:'PREVIEW_TEST_ONLY'},404);
 if(!reversalBearer(req.headers.get('authorization')||'',env.TIMEEASE_TEST_WORKER_SECRET))return reply({error:'UNAUTHORIZED'},401);
 if(req.headers.get('content-type')!=='application/json')return reply({error:'JSON_REQUIRED'},415);
 const topic=req.headers.get('x-shopify-topic');
 if(topic!=='orders/cancelled'&&topic!=='refunds/create')return reply({error:'FIXED_REVERSAL_TOPIC_REQUIRED'},400);
 if(req.headers.get('x-shopify-shop-domain')!=='preview.invalid')return reply({error:'SYNTHETIC_SHOP_REQUIRED'},403);
 const f=REVERSAL_FIXTURES[topic];if(!req.body)return reply({error:'INVALID_BODY'},400);
 const reader=req.body.getReader();const chunks:Buffer[]=[];let size=0;
 try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>1024){await reader.cancel();return reply({error:'BODY_TOO_LARGE'},413);}chunks.push(Buffer.from(r.value));}}
 finally{reader.releaseLock();}
 const raw=Buffer.concat(chunks).toString('utf8');
 if(!reversalSignature(raw,req.headers.get('x-shopify-hmac-sha256')))return reply({error:'INVALID_WEBHOOK_SIGNATURE'},401);
 if(raw!==reversalPayload(topic))return reply({error:'FIXED_SYNTHETIC_PAYLOAD_REQUIRED'},422);
 const state=shopifyPaymentState(topic,JSON.parse(raw));
 if(state.kind!=='HOLD'||state.orderId!==f.orderId||state.reason!==f.reason)return reply({error:'REVERSAL_BINDING_REQUIRED'},422);
 let url:URL;try{url=new URL(env.TIMEEASE_PREVIEW_REVERSAL_DATABASE_URL||'');}catch{return reply({error:'PREVIEW_PAYMENT_CONNECTION_REQUIRED'},503);}
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.username!==REVERSAL_LOGIN||url.pathname!=='/neondb'||!url.password||!isIsolatedNeonEndpoint(url.hostname))return reply({error:'PREVIEW_PAYMENT_SCOPE_REQUIRED'},503);
 url.searchParams.set('sslmode','verify-full');
 const pool=new Pool({connectionString:url.toString(),max:1,connectionTimeoutMillis:4000,statement_timeout:5000});let c:PoolClient|undefined;
 try{
  c=await pool.connect();const tls=c.connection.stream as unknown as {encrypted?:boolean;authorized?:boolean;getProtocol?:()=>string|null};
  const protocol=tls.getProtocol?.();if(tls.encrypted!==true||tls.authorized!==true||!['TLSv1.2','TLSv1.3'].includes(protocol||''))throw Error('TLS_REQUIRED');
  await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='3s'");await c.query("SET LOCAL idle_in_transaction_session_timeout='10s'");
  const who=(await c.query("SELECT current_database() AS database,session_user AS login,current_setting('neon.project_id',true) AS project,current_setting('neon.branch_id',true) AS branch")).rows[0];
  if(who.database!=='neondb'||who.login!==REVERSAL_LOGIN||who.project!==PREVIEW_NEON_PROJECT||who.branch!==PREVIEW_NEON_BRANCH)throw Error('EXACT_PREVIEW_DATABASE_REQUIRED');
  await c.query('SET LOCAL ROLE timeease_payment_limited');
  const role=(await c.query("SELECT current_user AS role,has_table_privilege(current_user,'public.timeease_v2_orders','DELETE') OR has_table_privilege(current_user,'public.timeease_v2_orders','TRUNCATE') AS forbidden")).rows[0];
  if(role.role!=='timeease_payment_limited'||role.forbidden!==false)throw Error('LIMITED_PAYMENT_ROLE_REQUIRED');
  const r=(await c.query('SELECT * FROM public.timeease_v2_orders WHERE intake_id=$1 FOR UPDATE',[f.intakeId])).rows[0];
  if(!r||r.shopify_order_id!==f.orderId||r.shopify_shop_domain!=='preview.invalid'||r.variant_id!=='synthetic-invoice'||r.customer_email!=='reversal@example.invalid'||Number(r.amount_usd)!==1||r.source_manifest_path!==`intake-v2/${f.intakeId}/manifest.json`||r.status!=='PAID'||r.processing_attempts!==0||r.result_path||r.delivery_message_id)throw Error('FRESH_FIXED_FIXTURE_REQUIRED');
  const others=async()=> (await c!.query("SELECT md5(COALESCE(jsonb_agg(to_jsonb(o) ORDER BY intake_id)::text,'[]')) AS fingerprint FROM public.timeease_v2_orders o WHERE NOT(intake_id=ANY($1::uuid[]))",[Object.values(REVERSAL_FIXTURES).map(x=>x.intakeId)])).rows[0].fingerprint;
  const before=await others();
  const held=await holdShopifyPayment(f.orderId,'preview.invalid',f.reason,c);
  const row=(await c.query('SELECT status,processing_attempts,result_path,delivery_message_id FROM public.timeease_v2_orders WHERE intake_id=$1',[f.intakeId])).rows[0];
  const holds=(await c.query('SELECT count(*)::int AS count FROM public.timeease_payment_holds WHERE shop_domain=$1 AND shopify_order_id=$2',['preview.invalid',f.orderId])).rows[0].count;
  if(held!=='HELD'||row.status!=='REVIEW_REQUIRED'||row.processing_attempts!==0||row.result_path||row.delivery_message_id||holds!==1||before!==await others())throw Error('FREEZE_VERIFICATION_REQUIRED');
  await c.query('COMMIT');return reply({synthetic:true,signatureVerified:true,signingScope:'PUBLIC_PREVIEW_FIXTURE_NOT_LIVE',topic,intakeId:f.intakeId,paymentState:row.status,holdCount:holds,attempts:0,otherOrdersUnchanged:true,project:who.project,branch:who.branch,database:who.database,role:role.role,tlsProtocol:protocol,tlsAuthorized:true,send:false,emailSent:false,workerStarted:false},200);
 }catch{return await c?.query('ROLLBACK').catch(()=>{}),reply({error:'PREVIEW_REVERSAL_UNAVAILABLE',send:false},503);}
 finally{c?.release();await pool.end().catch(()=>{});}
}
