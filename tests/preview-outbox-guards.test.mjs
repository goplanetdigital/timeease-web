import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
const compile=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const guards={};vm.runInNewContext(compile('lib/test-worker-guards.ts'),{exports:guards});
const fixtures={};vm.runInNewContext(compile('lib/preview-order-fixture.ts'),{exports:fixtures,Buffer,require:()=>guards});
const cases={outbox_persist:'b8f0b839-e0ff-4ef5-bf90-c32513c83fbf',outbox_failure:'712fb48a-03e8-470f-82fe-e8a5dbe12b7e',outbox_timeout:'52c899ce-3ea0-4d03-b9df-7e5ae2d83d99'};
const env={VERCEL_ENV:'preview',VERCEL_URL:'preview.example.vercel.app',VERCEL_GIT_COMMIT_REF:fixtures.PREVIEW_ORDER_BRANCH,
 TIMEEASE_ISOLATED_TEST_MODE:'true',TIMEEASE_V2_CHECKOUT_ENABLED:'false',TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'false',
 TIMEEASE_TEST_ALLOWED_RECIPIENT:fixtures.TEST_RECIPIENT,TIMEEASE_TEST_WORKER_SECRET:'synthetic-outbox-unit-only-never-live',
 TIMEEASE_DB_DATABASE_URL:'postgresql://timeease_worker_limited:synthetic@ep-restless-hill-ao5vpgb4.c-2.ap-southeast-1.aws.neon.tech/neondb'};
function setup(kind,{overrides={},schemaError='OUTBOX_SCHEMA_NOT_READY'}={}){
 const api={},calls=[],configs=[];
 const client={connection:{stream:{encrypted:true,authorized:true,getProtocol:()=> 'TLSv1.3'}},release(){},query:async(sql,args)=>{
  calls.push({op:'sql',sql,args});if(sql.startsWith('SELECT current_user'))return {rows:[{role:'timeease_worker_limited',database:'neondb',project:'odd-base-63790740',branch:'br-restless-hill-ao5vpgb4',elevated:false,member:false,forbidden_write:false}]};return {rows:[]};}};
 vm.runInNewContext(compile('app/api/test-worker/order-e2e/route.ts'),{exports:api,process:{env:{...env,...overrides}},URL,Buffer,Error,
  require:n=>n==='next/server'?{NextResponse:{json:(data,o)=>({data,...o})}}:n==='node:crypto'?crypto:n==='pg'?{Pool:class{constructor(c){configs.push(c);}async connect(){return client;}async end(){}}}:
   n==='@vercel/blob'?{put:async()=>{throw Error('BLOB_WRITE_FORBIDDEN');}}:n.endsWith('preview-order-fixture')?fixtures:n.endsWith('test-worker-guards')?guards:
   n.endsWith('v2-delivery-outbox')?{requireV2OutboxSchema:async c=>{assert.equal(c,client);calls.push({op:'outbox-schema'});throw Error(schemaError);}}:
   n.endsWith('preview-runtime-evidence')?{previewBlobOptions:async()=>({storeId:'store_FI8APVuc1xuRZkAg'})}:{}
 });
 const request=(action,fields={},headers={},host=env.VERCEL_URL)=>({url:`https://${host}/api/test-worker/order-e2e`,headers:new Map([
  ['authorization',`Bearer ${env.TIMEEASE_TEST_WORKER_SECRET}`],['content-type','application/json'],...Object.entries(headers)]),
  body:new ReadableStream({start(c){c.enqueue(Buffer.from(JSON.stringify({action,case:kind,...fields})));c.close();}})});
 return {api,calls,configs,request};
}
test('Outbox cases are three new exact full bindings, separate from five terminal fixtures',()=>{
 for(const [kind,id] of Object.entries(cases)){
  assert.equal(fixtures.ORDER_FIXTURES[kind],id);assert.equal(fixtures.isOutboxPreviewFixture(kind),true);
  const row={intake_id:id,shopify_order_id:`preview-pr20-outbox-20261107:${kind}:${id}`,shopify_shop_domain:'preview.invalid',variant_id:'synthetic-invoice',amount_usd:1,customer_email:'jcaiworker@gmail.com',source_manifest_path:`intake-v2/${id}/manifest.json`};
  assert.equal(fixtures.fixtureMatches(row,kind),true);
  for(const change of [{intake_id:fixtures.ORDER_FIXTURES.reservation},{customer_email:'customer@example.com'},{shopify_order_id:'1033'},{source_manifest_path:'production/manifest.json'}])assert.equal(fixtures.fixtureMatches({...row,...change},kind),false);
 }
 for(const old of ['delivery','failure','race','reservation','delivery_v2'])assert.equal(fixtures.isOutboxPreviewFixture(old),false);
});
test('Outbox actions cannot operate any of the five terminal legacy cases',async()=>{
 for(const old of ['delivery','failure','race','reservation','delivery_v2'])for(const action of ['outbox_enqueue','outbox_claim','outbox_fail','outbox_recover']){
  const s=setup(old);assert.equal((await s.api.POST(s.request(action))).status,400);assert.equal(s.configs.length,0);
 }
});
test('Outbox no-email endpoints reject delivery, cleanup, old reservation, arbitrary IDs and time overrides',async()=>{
 for(const kind of Object.keys(cases)){
  for(const action of ['delivered','cleanup','reserve_delivery','review','recover']){
   const s=setup(kind);assert.equal((await s.api.POST(s.request(action))).status,400);assert.equal(s.configs.length,0);
  }
  for(const field of ['intakeId','recipient','messageId','deliveryId','leaseUntil','olderThanMinutes','resultPath','token']){
   const s=setup(kind);assert.equal((await s.api.POST(s.request('outbox_claim',{[field]:'1033'}))).status,400);assert.equal(s.configs.length,0);
  }
 }
 const s=setup('outbox_persist');assert.equal((await s.api.POST(s.request('outbox_recover'))).status,400);
 const t=setup('outbox_timeout');assert.equal((await t.api.POST(t.request('outbox_fail'))).status,400);
});
test('Outbox scope and bearer guards reject Production, other branch, aliases and wrong credentials before SQL',async()=>{
 for(const overrides of [{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},{TIMEEASE_V2_CHECKOUT_ENABLED:'true'},{TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'true'},{TIMEEASE_TEST_ALLOWED_RECIPIENT:'customer@example.com'}]){
  const s=setup('outbox_persist',{overrides});assert.equal((await s.api.POST(s.request('status'))).status,404);assert.equal(s.configs.length,0);
 }
 const s=setup('outbox_persist');assert.equal((await s.api.POST(s.request('status',{}, {},'timeease-ruby.vercel.app'))).status,404);
 assert.equal((await s.api.POST(s.request('status',{}, {authorization:'Bearer wrong'}))).status,401);assert.equal(s.configs.length,0);
});
test('Outbox old FK or missing privileges fails closed before fixture/Blob mutations with safe 503',async()=>{
 for(const schemaError of ['OUTBOX_SCHEMA_NOT_READY','OUTBOX_ROLE_NOT_READY'])for(const kind of Object.keys(cases)){
  const s=setup(kind,{schemaError}),r=await s.api.POST(s.request('prepare'));
  assert.equal(r.status,503);assert.equal(r.data.error,schemaError);
  assert.equal(s.calls.some(c=>c.sql?.startsWith('SELECT *')),false);
  assert.equal(s.calls.at(-1).sql,'ROLLBACK');assert.equal(JSON.stringify(r).includes(env.TIMEEASE_TEST_WORKER_SECRET),false);
 }
});
