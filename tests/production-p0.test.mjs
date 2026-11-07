import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import * as crypto from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';

// Only new production orchestration/holds/gates. No HTTP to Neon/Stripe/Shopify,
// no mail, old fixture IDs or rerun of accepted Preview transaction/timeout suites.
function modules(env={},extra={}){
 const cache=new Map();const load=path=>{
  path=resolve(path.replace(/\.ts$/,'')+'.ts');if(cache.has(path))return cache.get(path);
  const exports={};cache.set(path,exports);
  const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,process:{env},URL,Buffer,TextDecoder,ReadableStream,console,
   require:name=>extra[name]??((name==='node:crypto'||name==='crypto')?crypto:name==='pg'?{Pool:class{constructor(){throw Error('NETWORK_FORBIDDEN');}}}:
    name==='next/server'?{NextResponse:{json:(body,options)=>({body,...options})}}:
    name==='@vercel/oidc'?{getVercelOidcToken:()=>{throw Error('OIDC_FORBIDDEN');}}:name==='@vercel/blob'?{head:()=>{throw Error('BLOB_FORBIDDEN');}}:
    name.startsWith('.')?load(resolve(dirname(path),name)):(()=>{throw Error('IMPORT_FORBIDDEN:'+name);})())});return exports;
 };return load;
}
const valid={VERCEL_ENV:'production',VERCEL_PROJECT_ID:'prj_2w1jB9WzF64hLNb6jRDxQw3LGSKR',
 VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),TIMEEASE_RELEASE_COMMIT_SHA:'a'.repeat(40),TIMEEASE_V2_OUTBOX_ENABLED:'true',
 TIMEEASE_RELEASE_ACCEPTING_WORK:'true',TIMEEASE_RELEASE_SEND_ENABLED:'true',TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'true'};
const load=modules(),release=load('lib/production-release'),scope=load('lib/production-database'),
 delivery=load('lib/production-delivery'),reversal=load('lib/payment-reversal'),paid=load('lib/paid-order-ledger'),mapping=load('lib/shopify-payment-state');
const localSchema=readFileSync('tests/fixtures/v2-outbox-schema.sql','utf8')+`
 CREATE TABLE public.timeease_payment_holds(shop_domain text NOT NULL,shopify_order_id text NOT NULL,
 reason text NOT NULL CHECK(reason IN ('CANCELLED','REFUNDED')),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(shop_domain,shopify_order_id));`;
const client=q=>({query:async(sql,args)=>{const r=await q.query(sql,args);return {...r,rowCount:r.rowCount??r.affectedRows??r.rows.length};}});
const run=(db,fn)=>db.transaction(tx=>fn(client(tx)));
async function db(){const d=new PGlite();await d.exec(localSchema);return d;}
async function seed(d,status='PROCESSING',orderId='12345'){
 const id=randomUUID();await d.query(`INSERT INTO timeease_v2_orders(intake_id,shopify_order_id,shopify_shop_domain,variant_id,
 amount_usd,source_manifest_path,status,processing_attempts) VALUES($1,$2,'example.myshopify.com','123',9,$3,$4,1)`,[id,orderId,`intake-v2/${id}/manifest.json`,status]);return id;
}
const report=(d,id,action,other={},send=true,verify=async()=>true)=>run(d,c=>delivery.reportProductionDelivery({intakeId:id,action,...other},c,false,send,verify));
const snap=async(d,id)=>(await d.query(`SELECT to_jsonb(o) AS order_row,(SELECT to_jsonb(b) FROM timeease_fulfillment_outbox b WHERE b.intake_id=o.intake_id) AS outbox,
 (SELECT to_jsonb(l) FROM timeease_delivery_ledger l WHERE l.intake_id=o.intake_id) AS ledger FROM timeease_v2_orders o WHERE intake_id=$1`,[id])).rows[0];

test('release is bound to exact environment/project/commit; send freeze does not close receipt drain',()=>{
 assert.equal(release.productionReleaseBound(valid),true);
 for(const wrong of [{VERCEL_ENV:'preview'},{VERCEL_PROJECT_ID:'preview-project'},{TIMEEASE_RELEASE_COMMIT_SHA:'b'.repeat(40)},{TIMEEASE_ISOLATED_TEST_MODE:'true'},{TIMEEASE_V2_OUTBOX_ENABLED:'false'}])
  assert.equal(release.productionReleaseBound({...valid,...wrong}),false);
 const frozen={...valid,TIMEEASE_RELEASE_ACCEPTING_WORK:'false',TIMEEASE_RELEASE_SEND_ENABLED:'false'};
 assert.equal(release.productionReleaseBound(frozen),true);assert.equal(release.acceptingProductionWork(frozen),false);assert.equal(release.productionSendEnabled(frozen),false);
 assert.equal(release.stripeBillingReleased(),false);
});
test('dedicated least-privilege URLs and verified TLS have no payment URL fallback',async()=>{
 const raw='postgresql://timeease_worker_limited:synthetic@ep-test.neon.tech/neondb?sslmode=disable';
 assert.equal(new URL(scope.productionConnection('worker',{...valid,TIMEEASE_WORKER_DATABASE_URL:raw})).searchParams.get('sslmode'),'verify-full');
 for(const env of [{...valid,TIMEEASE_DB_DATABASE_URL:raw},{...valid,TIMEEASE_WORKER_DATABASE_URL:raw.replace('timeease_worker_limited','neondb_owner')},{...valid,TIMEEASE_WORKER_DATABASE_URL:raw.replace('ep-test.neon.tech','example.invalid')}])assert.throws(()=>scope.productionConnection('worker',env));
 let calls=0;await assert.rejects(scope.assertProductionDatabase({query:async()=>{calls++;return {rows:[{database:'neondb',role:'timeease_worker_limited',project:'odd-base-63790740',branch:'br-restless-hill-ao5vpgb4',elevated:false,member:false,forbidden:false,can_insert_orders:false,can_update_binding:false}]};}},'worker'),/IDENTITY_REQUIRED/);assert.equal(calls,1);
});
test('all formal Worker routes and unsupported Stripe mutations close before request reads in Preview',async()=>{
 for(const name of ['claim','pending','result','report','recover','manifest','source','ops-status','auth-check']){
  const route=modules({VERCEL_ENV:'preview'})(`app/api/worker/${name}/route`);
  const response=await (route.POST??route.GET)({headers:{get(){throw Error('REQUEST_READ_BEFORE_GATE');}}});assert.equal(response.status,503,name);
 }
 for(const name of ['checkout','webhook','use-credits'])assert.equal((await modules(valid)(`app/api/subscription/${name}/route`).POST({})).status,503);
});
test('real Shopify state mapping rejects pending/authorized/test/unsafe IDs and recognizes reversal ordering',()=>{
 for(const status of ['pending','authorized','partially_paid','refunded','voided'])assert.equal(mapping.shopifyPaymentState('orders/paid',{id:'123',test:false,financial_status:status}).kind,'REJECT');
 assert.equal(mapping.shopifyPaymentState('orders/paid',{id:'123',test:true,financial_status:'paid'}).kind,'REJECT');
 assert.equal(mapping.shopifyPaymentState('orders/paid',{id:Number.MAX_SAFE_INTEGER+1,test:false,financial_status:'paid'}).kind,'REJECT');
 assert.equal(mapping.shopifyPaymentState('orders/paid',{id:'123',test:false,financial_status:'paid'}).kind,'PAID');
 assert.equal(mapping.shopifyPaymentState('orders/paid',{id:'123',test:false,financial_status:'paid',cancelled_at:'present'}).reason,'CANCELLED');
 assert.equal(mapping.shopifyPaymentState('refunds/create',{order_id:'123'}).reason,'REFUNDED');
});
test('formal report publishes actual Outbox rows and demands the bound delivery UUID; receipts drain during freeze',async()=>{
 const d=await db();try{
  const id=await seed(d);assert.equal((await report(d,id,'result_ready',{resultPath:`results-v2/${id}/consolidated.xlsx`})).body.outbox,'ENQUEUED');
  const initial=await snap(d,id);assert.equal(initial.outbox.status,'PENDING');
  assert.equal((await report(d,id,'outbox_claim',{},false)).body.error,'SEND_DISABLED');assert.deepEqual(await snap(d,id),initial);
  assert.equal((await report(d,id,'reserve_delivery')).body.error,'OUTBOX_ACTION_REQUIRED');
  const claim=await report(d,id,'outbox_claim');assert.equal(claim.body.send,true);const deliveryId=claim.body.deliveryId;
  assert.equal((await report(d,id,'delivered',{deliveryId:randomUUID(),messageId:'abcdef0123456789'})).status,409);
  assert.equal((await report(d,id,'delivered',{deliveryId,messageId:'abcdef0123456789'},false)).status,200);
  const final=await snap(d,id);assert.equal(final.order_row.status,'DELIVERED');assert.equal(final.outbox.status,'DELIVERED');assert.equal(final.ledger.status,'SENT');
 }finally{await d.close();}
});
test('failed result verification and uncertain delivery do not authorize mail',async()=>{
 const d=await db();try{
  const id=await seed(d);const before=await snap(d,id);
  assert.equal((await report(d,id,'result_ready',{resultPath:`results-v2/${id}/consolidated.xlsx`},true,async()=>false)).status,409);assert.deepEqual(await snap(d,id),before);
  await report(d,id,'result_ready',{resultPath:`results-v2/${id}/consolidated.xlsx`});await report(d,id,'outbox_claim');
  assert.equal((await report(d,id,'review')).body.send,false);const x=await snap(d,id);assert.equal(x.ledger.status,'UNKNOWN');assert.equal(x.outbox.status,'FAILED');assert.equal(x.order_row.status,'REVIEW_REQUIRED');
 }finally{await d.close();}
});
test('refund before paid persists a hold; a late paid webhook cannot create or reset an order',async()=>{
 const d=await db();try{
  assert.equal(await run(d,c=>reversal.holdShopifyPayment('321','example.myshopify.com','REFUNDED',c)),'UNMATCHED_HELD');
  const binding={intakeId:randomUUID(),variantId:'123',amountUsd:9,expiresAt:123};
  assert.equal(await run(d,c=>paid.recordVerifiedPayment(binding,'321','example.myshopify.com',null,c)),'PAYMENT_HELD');
  assert.equal((await d.query('SELECT count(*)::int AS n FROM timeease_v2_orders')).rows[0].n,0);
  assert.equal(await run(d,c=>reversal.holdShopifyPayment('321','example.myshopify.com','CANCELLED',c)),'UNMATCHED_HELD');
  assert.equal((await d.query('SELECT count(*)::int AS n FROM timeease_payment_holds')).rows[0].n,1);
 }finally{await d.close();}
});
test('refund of an in-flight send quarantines Outbox/ledger together; terminal orders stay byte-identical',async()=>{
 const d=await db();try{
  const id=await seed(d);await report(d,id,'result_ready',{resultPath:`results-v2/${id}/consolidated.xlsx`});await report(d,id,'outbox_claim');
  assert.equal(await run(d,c=>reversal.holdShopifyPayment('12345','example.myshopify.com','REFUNDED',c)),'HELD');
  const x=await snap(d,id);assert.equal(x.ledger.status,'UNKNOWN');assert.equal(x.outbox.status,'FAILED');assert.equal(x.order_row.status,'REVIEW_REQUIRED');assert.equal(x.outbox.attempt_count,1);
  assert.equal(await run(d,c=>reversal.holdShopifyPayment('12345','example.myshopify.com','REFUNDED',c)),'TERMINAL_RETAINED');assert.deepEqual(await snap(d,id),x);
  const done=await seed(d,'DELIVERED','98765');const before=await snap(d,done);
  assert.equal(await run(d,c=>reversal.holdShopifyPayment('98765','example.myshopify.com','CANCELLED',c)),'TERMINAL_RETAINED');assert.deepEqual(await snap(d,done),before);
 }finally{await d.close();}
});
test('reversal SQL failure rolls back the new hold and order transition',async()=>{
 const d=await db();try{
  const id=await seed(d,'PAID');const before=await snap(d,id);
  await d.exec(`CREATE FUNCTION reject_review() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'LOCAL_REVERSAL_FAILURE'; END $$;
   CREATE TRIGGER reject_review BEFORE UPDATE ON timeease_v2_orders FOR EACH ROW EXECUTE FUNCTION reject_review();`);
  await assert.rejects(run(d,c=>reversal.holdShopifyPayment('12345','example.myshopify.com','REFUNDED',c)),/LOCAL_REVERSAL_FAILURE/);
  assert.deepEqual(await snap(d,id),before);assert.equal((await d.query('SELECT count(*)::int AS n FROM timeease_payment_holds')).rows[0].n,0);
 }finally{await d.close();}
});
test('new Production transaction rolls back callback failure and always releases its connection',async()=>{
 const calls=[];const c={release(){calls.push('release');},async query(sql){calls.push(sql);
  if(sql.startsWith('SELECT current_database'))return {rows:[{database:'neondb',role:'timeease_worker_limited',project:'odd-base-63790740',branch:'br-wispy-river-aoo9eown',elevated:false,member:false,forbidden:false,can_update_binding:false,can_insert_orders:false}]};
  if(sql.includes('AS schema_ready'))return {rows:[{schema_ready:true,permissions_ready:true}]};return {rows:[],rowCount:0};}};
 const api=modules({...valid,TIMEEASE_WORKER_DATABASE_URL:'postgresql://timeease_worker_limited:synthetic@ep-test.neon.tech/neondb'},
  {pg:{Pool:class{async connect(){return c;}async end(){calls.push('end');}}}})('lib/production-database');
 await assert.rejects(api.productionTransaction('worker',async()=>{throw Error('LOCAL_CALLBACK_FAILURE');}),/LOCAL_CALLBACK_FAILURE/);
 assert.ok(calls.includes('BEGIN'));assert.ok(calls.includes('ROLLBACK'));assert.equal(calls.includes('COMMIT'),false);assert.deepEqual(calls.slice(-2),['release','end']);
});
test('proposed migration executes only in local PostgreSQL fixture and grants purpose-specific privileges',async()=>{
 const d=new PGlite();try{
  // Local schema starts with old FKs; one existing V2 row must survive unchanged.
  await d.exec(readFileSync('tests/fixtures/v2-outbox-schema.sql','utf8').replaceAll('REFERENCES public.timeease_v2_orders(intake_id)','REFERENCES public.timeease_paid_intake_claims(intake_id)'));
  const id=await seed(d,'REVIEW_REQUIRED');const before=await snap(d,id);
  const proposal=readFileSync('docs/production-outbox-migration.proposed.sql','utf8');
  assert.match(proposal,/br-wispy-river-aoo9eown/);assert.match(proposal,/EXACT_PRODUCTION_OPERATOR_REQUIRED/);
  // Neon identity/operator cannot exist in PGlite. Remove that scope guard only
  // for this local syntax/permission test; map the database grant to local DB.
  const local=proposal.replace(/DO \$scope\$[\s\S]*?END \$scope\$;/,'').replace('ON DATABASE neondb','ON DATABASE '+(await d.query('SELECT current_database() AS name')).rows[0].name);
  await d.exec(local);assert.deepEqual(await snap(d,id),before);
  const rows=(await d.query(`SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname IN ('timeease_worker_limited','timeease_payment_limited')`)).rows;
  assert.equal(rows.length,2);assert.equal(rows.some(x=>x.rolcanlogin||x.rolsuper||x.rolcreatedb||x.rolcreaterole||x.rolbypassrls),false);
  const perms=(await d.query(`SELECT has_table_privilege('timeease_worker_limited','timeease_v2_orders','INSERT') AS worker_insert_order,
   has_table_privilege('timeease_payment_limited','timeease_fulfillment_outbox','INSERT') AS payment_insert_queue,
   has_table_privilege('timeease_worker_limited','timeease_payment_holds','INSERT') AS worker_insert_hold,
   has_table_privilege('timeease_worker_limited','timeease_fulfillment_outbox','DELETE') AS worker_delete,
   has_column_privilege('timeease_worker_limited','timeease_fulfillment_outbox','intake_id','UPDATE') AS worker_rebind`)).rows[0];
  assert.equal(Object.values(perms).some(Boolean),false);
 }finally{await d.close();}
});
