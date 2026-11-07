import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
const compile=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const guards={};vm.runInNewContext(compile('lib/test-worker-guards.ts'),{exports:guards});
const fixtures={};vm.runInNewContext(compile('lib/preview-order-fixture.ts'),{exports:fixtures,Buffer,require:()=>guards});
const fresh={race:'29a22afd-a1d7-47d2-b97b-03d2a3eaa0c8',reservation:'37a129e0-e879-4f6a-b306-3c112afd3d5a',delivery_v2:'6b2322d8-c7a0-45ff-9ab3-082e2684a067'};
const env={VERCEL_ENV:'preview',VERCEL_URL:'preview.example.vercel.app',VERCEL_GIT_COMMIT_REF:fixtures.PREVIEW_ORDER_BRANCH,
 TIMEEASE_ISOLATED_TEST_MODE:'true',TIMEEASE_V2_CHECKOUT_ENABLED:'false',TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'false',
 TIMEEASE_TEST_ALLOWED_RECIPIENT:fixtures.TEST_RECIPIENT,TIMEEASE_TEST_WORKER_SECRET:'synthetic-unit-secret-never-a-live-credential',
 TIMEEASE_DB_DATABASE_URL:'postgresql://timeease_worker_limited:synthetic@ep-restless-hill-ao5vpgb4.c-2.ap-southeast-1.aws.neon.tech/neondb'};
const makeRow=kind=>{const id=fixtures.ORDER_FIXTURES[kind];return {intake_id:id,
 shopify_order_id:`preview-pr20-20261106-r1:${kind==='delivery_v2'?'delivery':kind}:${id}`,
 shopify_shop_domain:'preview.invalid',variant_id:'synthetic-invoice',amount_usd:1,customer_email:fixtures.TEST_RECIPIENT,
 source_manifest_path:`intake-v2/${id}/manifest.json`,status:'PAID',processing_attempts:0,result_path:null,delivery_message_id:null};};
function setup(kind,{overrides={},record=makeRow(kind),reservation='RESERVED',recovered=false}={}){
 const api={},calls=[],objects=new Map(),configs=[];
 const client={connection:{stream:{encrypted:true,authorized:true,getProtocol:()=> 'TLSv1.3'}},release(){},
  query:async(sql,args)=>{calls.push({op:'sql',sql,args});
   if(sql.startsWith('SELECT current_user'))return {rows:[{role:'timeease_worker_limited',database:'neondb',project:'odd-base-63790740',branch:'br-restless-hill-ao5vpgb4',elevated:false,member:false,forbidden_write:false}]};
   if(sql.startsWith('SELECT *'))return {rows:record?[record]:[]};return {rows:[]};}};
 const shared={claimPaidJob:async(id,c)=>{assert.equal(c,client);calls.push({op:'claim',id});return {...record,processing_attempts:1};},
  reserveDelivery:async(id,c)=>{assert.equal(c,client);calls.push({op:'reserve',id});return reservation;},
  markResultReady:async(id,path,c)=>{assert.equal(c,client);calls.push({op:'result',id,path});return true;},
  markDelivered:async()=>{throw Error('NEW_FIXTURE_DELIVERY_FORBIDDEN');},flagForReview:async()=>true};
 const blob={put:async(path,b,opts)=>{calls.push({op:'put',path,opts});objects.set(path,Buffer.from(b));},
  get:async(path)=>{const b=objects.get(path);return b?{stream:new ReadableStream({start(c){c.enqueue(b);c.close();}})}:null;},
  head:async path=>({size:objects.get(path).length}),del:async()=>{throw Error('NEW_FIXTURE_CLEANUP_FORBIDDEN');},list:async()=>({blobs:[]})};
 vm.runInNewContext(compile('app/api/test-worker/order-e2e/route.ts'),{exports:api,process:{env:{...env,...overrides}},URL,Buffer,
  require:n=>n==='next/server'?{NextResponse:{json:(data,o)=>({data,...o})}}:n==='node:crypto'?crypto:n==='pg'?{Pool:class{constructor(c){configs.push(c);}async connect(){return client;}async end(){}}}:
   n==='@vercel/blob'?blob:n.endsWith('preview-order-fixture')?fixtures:n.endsWith('test-worker-guards')?guards:
   n.endsWith('paid-job-claim')?shared:n.endsWith('preview-order-recovery')?{recoverPreviewFailure:async(id,c)=>{assert.equal(c,client);calls.push({op:'recover',id});return recovered;}}:
   {previewBlobOptions:async()=>({storeId:'store_FI8APVuc1xuRZkAg'})}});
 const request=(action,fields={})=>({url:`https://${env.VERCEL_URL}/api/test-worker/order-e2e`,
  headers:new Map([['authorization',`Bearer ${env.TIMEEASE_TEST_WORKER_SECRET}`],['content-type','application/json']]),
  body:new ReadableStream({start(c){c.enqueue(Buffer.from(JSON.stringify({action,case:kind,...fields})));c.close();}})});
 const seed=()=>{const id=fixtures.ORDER_FIXTURES[kind],prefix=`intake-v2/${id}/`,pdf=fixtures.syntheticInvoicePdf();
  objects.set(prefix+'file-001.pdf',pdf);objects.set(prefix+'manifest.json',Buffer.from(JSON.stringify({id,synthetic:true,service:'invoice',files:[{pathname:prefix+'file-001.pdf',bytes:pdf.length,originalName:'synthetic-test-004.pdf'}]})));};
 return {api,calls,configs,request,seed};
}
test('new fixed cases match only the three reviewed complete synthetic bindings',()=>{
 assert.equal(fixtures.ORDER_FIXTURES.delivery,'d7438959-82c2-4d9a-959c-b065ecc12720');
 assert.equal(fixtures.ORDER_FIXTURES.failure,'5b6b7ad4-3ff3-409c-a584-d47c6d77ca97');
 for(const [kind,id] of Object.entries(fresh)){
  assert.equal(fixtures.ORDER_FIXTURES[kind],id);assert.equal(fixtures.fixtureMatches(makeRow(kind),kind),true);
  for(const [field,value] of Object.entries({intake_id:fixtures.ORDER_FIXTURES.delivery,shopify_order_id:'1033',customer_email:'customer@example.com',source_manifest_path:'production/manifest.json',shopify_shop_domain:'real.myshopify.com',variant_id:'real-variant',amount_usd:9})){
   assert.equal(fixtures.fixtureMatches({...makeRow(kind),[field]:value},kind),false);
  }
 }
 for(const value of ['1033','__proto__','constructor','toString','random',null,{}])assert.equal(fixtures.isPreviewFixtureCase(value),false);
});
test('new cases cannot delegate arbitrary IDs or bypass unchanged isolation gates',async()=>{
 for(const kind of Object.keys(fresh)){
  for(const field of ['intakeId','recipient','resultPath','token','olderThanMinutes']){
   const s=setup(kind);assert.equal((await s.api.POST(s.request('status',{[field]:'1033'}))).status,400);assert.equal(s.configs.length,0);
  }
  for(const overrides of [{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},{TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'true'},{TIMEEASE_V2_CHECKOUT_ENABLED:'true'},{TIMEEASE_TEST_ALLOWED_RECIPIENT:'customer@example.com'}]){
   const s=setup(kind,{overrides});assert.equal((await s.api.POST(s.request('claim'))).status,404);assert.equal(s.configs.length,0);
  }
 }
});
test('new cases reject mismatched stored bindings before any transition',async()=>{
 for(const kind of Object.keys(fresh))for(const record of [null,{...makeRow(kind),shopify_order_id:'preview-e2e:delivery:'+fresh[kind]},{...makeRow(kind),customer_email:'customer@example.com'}]){
  const s=setup(kind,{record});assert.equal((await s.api.POST(s.request('claim'))).status,409);assert.equal(s.calls.some(c=>c.op==='claim'),false);
 }
});
test('new claim uses the exact fixed ID and the verified locked transaction client',async()=>{
 for(const kind of Object.keys(fresh)){
  const s=setup(kind);s.seed();const r=await s.api.POST(s.request('claim'));assert.equal(r.status,200);
  assert.equal(s.calls.find(c=>c.op==='claim').id,fresh[kind]);assert.ok(s.calls.some(c=>c.sql?.includes('FOR UPDATE')));
  assert.equal(s.calls.at(-1).sql,'COMMIT');
 }
});
test('new fixtures cannot complete delivery or clean objects; reservation is exact-case only',async()=>{
 for(const kind of Object.keys(fresh))for(const action of ['delivered','cleanup']){
  const s=setup(kind);assert.equal((await s.api.POST(s.request(action,{messageId:'1a19d542ab77c744'}))).status,400);assert.equal(s.configs.length,0);
 }
 for(const kind of ['race','delivery_v2','delivery','failure']){
  const s=setup(kind);assert.equal((await s.api.POST(s.request('reserve_delivery'))).status,400);assert.equal(s.configs.length,0);
 }
});
test('new reservation uses shared function and never advertises email or Outbox success',async()=>{
 for(const reservation of ['RESERVED','ALREADY_RESERVED','NOT_RESERVABLE']){
  const s=setup('reservation',{record:{...makeRow('reservation'),status:'PROCESSING',result_path:`results-v2/${fresh.reservation}/consolidated.xlsx`},reservation});
  const r=await s.api.POST(s.request('reserve_delivery'));assert.equal(r.status,reservation==='NOT_RESERVABLE'?409:200);
  assert.equal(r.data.reservation,reservation);assert.equal(r.data.send,false);assert.equal(r.data.noEmailSent,true);assert.equal(r.data.outboxVerified,false);
  assert.equal(s.calls.find(c=>c.op==='reserve').id,fresh.reservation);
 }
});
test('new recovery is restricted to fixed failure-test IDs and preserves real ten-minute SQL',async()=>{
 const api={},queries=[];vm.runInNewContext(compile('lib/preview-order-recovery.ts'),{exports:api,require:()=>fixtures});
 const client={query:async(sql,args)=>{queries.push({sql,args});return {rowCount:1};}};
 for(const id of [fresh.race,fresh.delivery_v2])assert.equal(await api.recoverPreviewFailure(id,client),true);
 for(const id of [fresh.reservation,fixtures.ORDER_FIXTURES.delivery,'1033','00000000-0000-4000-8000-000000000000'])await assert.rejects(api.recoverPreviewFailure(id,client),/FAILURE_FIXTURE_REQUIRED/);
 assert.equal(queries.length,2);for(const q of queries){assert.match(q.sql,/processing_started_at < now\(\) - interval '10 minutes'/);assert.match(q.sql,/status='REVIEW_REQUIRED'/);}
 for(const kind of ['race','delivery_v2'])for(const recovered of [false,true]){
  const s=setup(kind,{record:{...makeRow(kind),status:'PROCESSING'},recovered});const r=await s.api.POST(s.request('recover'));
  assert.equal(r.status,recovered?200:409);assert.equal(r.data.noAutoRetry,true);assert.equal(r.data.noEmailSent,true);
 }
 const s=setup('reservation');assert.equal((await s.api.POST(s.request('recover'))).status,400);assert.equal(s.configs.length,0);
});
test('new result action is limited to reservation and keeps OIDC readback without overwrites',async()=>{
 const xlsxBase64=Buffer.from('PK\x03\x04local-security-test-only').toString('base64');
 for(const kind of ['race','delivery_v2']){const s=setup(kind);assert.equal((await s.api.POST(s.request('result',{xlsxBase64}))).status,400);assert.equal(s.configs.length,0);}
 const s=setup('reservation',{record:{...makeRow('reservation'),status:'PROCESSING'}});
 const r=await s.api.POST(s.request('result',{xlsxBase64}));assert.equal(r.status,201);assert.equal(r.data.readBackVerified,true);
 const put=s.calls.find(c=>c.op==='put');assert.equal(put.path,`results-v2/${fresh.reservation}/consolidated.xlsx`);assert.equal(put.opts.allowOverwrite,false);assert.equal('token' in put.opts,false);
});
