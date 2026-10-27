import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
const compile=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const guards={};vm.runInNewContext(compile('lib/test-worker-guards.ts'),{exports:guards});
const fixture={};vm.runInNewContext(compile('lib/preview-order-fixture.ts'),{exports:fixture,Buffer,require:()=>guards});
const env={VERCEL_ENV:'preview',VERCEL_URL:'preview.example.vercel.app',VERCEL_GIT_COMMIT_REF:fixture.PREVIEW_ORDER_BRANCH,
 VERCEL_GIT_COMMIT_SHA:'synthetic-unit-commit',TIMEEASE_ISOLATED_TEST_MODE:'true',TIMEEASE_V2_CHECKOUT_ENABLED:'false',
 TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'false',TIMEEASE_TEST_ALLOWED_RECIPIENT:fixture.TEST_RECIPIENT,
 TIMEEASE_TEST_WORKER_SECRET:'synthetic-unit-test-secret-not-for-live-use',BLOB_READ_WRITE_TOKEN:'inherited-token-must-never-be-used',
 TIMEEASE_DB_DATABASE_URL:'postgresql://timeease_worker_limited:synthetic@ep-summer-salad-aoeax66z.c-2.ap-southeast-1.aws.neon.tech/neondb'};
const id=fixture.ORDER_FIXTURES.delivery;
const row={intake_id:id,shopify_order_id:`preview-e2e:delivery:${id}`,shopify_shop_domain:'preview.invalid',
 variant_id:'synthetic-invoice',amount_usd:1,customer_email:fixture.TEST_RECIPIENT,
 source_manifest_path:`intake-v2/${id}/manifest.json`,status:'PAID',processing_attempts:0,result_path:null,delivery_message_id:null};
const identity={role:'timeease_worker_limited',database:'neondb',project:'odd-base-63790740',branch:'br-rough-butterfly-aox5mukp',elevated:false,member:false,forbidden_write:false};
function setup({overrides={},record=row,who=identity,tls=true,blobFailure=false}={}){
 const effects=[],objects=new Map(),configs=[],databaseCalls=[];const exports={};
 const options={storeId:'store_FI8APVuc1xuRZkAg'};
 const client={connection:{stream:{encrypted:tls,authorized:tls,getProtocol:()=>tls?'TLSv1.3':null}},
  query:async(sql,args)=>{databaseCalls.push({sql,args});if(sql.startsWith('SELECT current_user'))return {rows:[who]};
   if(sql.startsWith('SELECT *'))return {rows:record?[record]:[]};return {rows:[]};},release(){}};
 class Pool{constructor(c){configs.push(c);}async connect(){return client;}async end(){}}
 const blobs={
  put:async(path,value,opts)=>{effects.push({op:'put',path,opts});if(blobFailure)throw Error('provider-secret-raw-error');objects.set(path,Buffer.from(value));return {pathname:path};},
  get:async(path,opts)=>{effects.push({op:'get',path,opts});const value=objects.get(path);return value?{stream:new ReadableStream({start(c){c.enqueue(value);c.close();}})}:null;},
  head:async(path,opts)=>{effects.push({op:'head',path,opts});return {size:objects.get(path)?.length};},
  del:async(paths,opts)=>{effects.push({op:'del',paths,opts});for(const p of Array.isArray(paths)?paths:[paths])objects.delete(p);},
  list:async(opts)=>({blobs:[...objects.keys()].filter(p=>p.startsWith(opts.prefix))})};
 const shared={claimPaidJob:async(value,c)=>{assert.equal(value,id);assert.equal(c,client);effects.push({op:'claim'});return {...record};},
  markResultReady:async(value,path,c)=>{assert.equal(value,id);assert.equal(c,client);effects.push({op:'result_ready'});return true;},
  markDelivered:async(value,receipt,c)=>{assert.equal(value,id);assert.equal(c,client);effects.push({op:'delivered'});return true;},
  flagForReview:async(value,reason,c)=>{assert.equal(value,id);assert.equal(c,client);effects.push({op:'review'});return true;}};
 vm.runInNewContext(compile('app/api/test-worker/order-e2e/route.ts'),{exports,process:{env:{...env,...overrides}},Buffer,URL,
  require:name=>name==='next/server'?{NextResponse:{json:(data,options)=>({data,...options})}}:name==='node:crypto'?crypto:
   name==='pg'?{Pool}:name==='@vercel/blob'?blobs:name.endsWith('preview-order-fixture')?fixture:
   name.endsWith('paid-job-claim')?shared:{previewBlobOptions:async()=>options}});
 const request=(body={action:'status'},headers={},host=env.VERCEL_URL)=>({url:`https://${host}/api/test-worker/order-e2e`,
  headers:new Map([['authorization',`Bearer ${env.TIMEEASE_TEST_WORKER_SECRET}`],['content-type','application/json'],...Object.entries(headers)]),
  body:new ReadableStream({start(c){c.enqueue(Buffer.from(JSON.stringify(body)));c.close();}})});
 const seedBlobs=()=>{const pdf=fixture.syntheticInvoicePdf(),prefix=`intake-v2/${id}/`;
  objects.set(prefix+'file-001.pdf',pdf);objects.set(prefix+'manifest.json',Buffer.from(JSON.stringify({id,synthetic:true,service:'invoice',files:[{pathname:prefix+'file-001.pdf',bytes:pdf.length,originalName:'synthetic-test-004.pdf'}]})));};
 return {api:exports,effects,configs,databaseCalls,request,seedBlobs,objects};
}
test('GET identifies Preview deployment and cannot create or process any order',async()=>{
 const s=setup();const r=await s.api.GET(s.request());assert.equal(r.status,200);assert.equal(r.data.environment,'preview');
 assert.equal(r.data.branch,fixture.PREVIEW_ORDER_BRANCH);assert.equal(r.data.customerRoutesBlocked,true);assert.equal(s.configs.length,0);assert.equal(s.effects.length,0);
});
test('Production, wrong branch, alias, recipient and payment flags fail before external access',async()=>{
 for(const overrides of [{VERCEL_ENV:'production'},{VERCEL_ENV:'development'},{VERCEL_GIT_COMMIT_REF:'main'},
  {TIMEEASE_TEST_ALLOWED_RECIPIENT:'customer@example.com'},{TIMEEASE_V2_CHECKOUT_ENABLED:'true'},{TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'true'}]){
  const s=setup({overrides});assert.equal((await s.api.POST(s.request())).status,404);assert.equal((await s.api.GET(s.request())).status,404);assert.equal(s.configs.length,0);
 }
 const s=setup();assert.equal((await s.api.POST(s.request({}, {},'timeease-ruby.vercel.app'))).status,404);assert.equal(s.configs.length,0);
});
test('only the existing test bearer is accepted; production credential is never a fallback',async()=>{
 for(const value of ['',`Bearer ${env.BLOB_READ_WRITE_TOKEN}`,'Bearer wrong']){
  const s=setup();assert.equal((await s.api.POST(s.request({action:'prepare'},{authorization:value}))).status,401);assert.equal(s.configs.length,0);
 }
 const s=setup({overrides:{TIMEEASE_TEST_WORKER_SECRET:undefined,TIMEEASE_V2_WORKER_SECRET:env.TIMEEASE_TEST_WORKER_SECRET}});
 assert.equal((await s.api.POST(s.request())).status,503);assert.equal(s.configs.length,0);
});
test('caller cannot supply an order, Blob path, customer email or unexpected fields',async()=>{
 for(const field of ['intakeId','resultPath','recipient','token','shopifyOrderId']){
  const s=setup();assert.equal((await s.api.POST(s.request({action:'prepare',[field]:'1033'}))).status,400);assert.equal(s.configs.length,0);
 }
 const s=setup();assert.equal((await s.api.POST(s.request({action:'status',case:'1033'}))).status,400);
});
test('wrong database URL is rejected before opening a connection',async()=>{
 for(const url of ['invalid','postgresql://neondb_owner:synthetic@production.example/neondb']){
  const s=setup({overrides:{TIMEEASE_DB_DATABASE_URL:url}});assert.equal((await s.api.POST(s.request())).status,503);assert.equal(s.configs.length,0);
 }
});
test('plaintext, invalid identity or elevated role cannot reach state or Blob mutations',async()=>{
 for(const args of [{tls:false},{who:{...identity,branch:'production'}},{who:{...identity,role:'neondb_owner'}},
  {who:{...identity,elevated:true}},{who:{...identity,member:true}},{who:{...identity,forbidden_write:true}}]){
  const s=setup(args);assert.equal((await s.api.POST(s.request({action:'prepare'}))).status,503);assert.equal(s.effects.length,0);
 }
});
test('missing fixture or a real-order/customer binding cannot be mutated',async()=>{
 for(const record of [null,{...row,shopify_order_id:'1033'},{...row,customer_email:'customer@example.com'},{...row,source_manifest_path:'production/manifest.json'}]){
  const s=setup({record});assert.equal((await s.api.POST(s.request({action:'claim'}))).status,409);assert.equal(s.effects.length,0);
 }
});
test('synthetic prepare uses only OIDC Store options and two exact fixed fixture paths',async()=>{
 const s=setup();const r=await s.api.POST(s.request({action:'prepare'}));assert.equal(r.status,200);assert.equal(r.data.prepared,true);
 assert.equal(s.effects.length,2);for(const e of s.effects){assert.equal(e.op,'put');assert.ok(e.path.startsWith(`intake-v2/${id}/`));
  assert.equal(e.opts.storeId,'store_FI8APVuc1xuRZkAg');assert.equal('token' in e.opts,false);assert.equal(e.opts.allowOverwrite,false);}
 assert.equal(JSON.stringify(r).includes(env.BLOB_READ_WRITE_TOKEN),false);assert.equal(new URL(s.configs[0].connectionString).searchParams.get('sslmode'),'verify-full');
});
test('claim dispatches to the shared transition through the locked client and checks synthetic source',async()=>{
 const missing=setup();assert.equal((await missing.api.POST(missing.request({action:'claim'}))).status,503);assert.equal(missing.effects.some(e=>e.op==='claim'),false);
 const s=setup();s.seedBlobs();const r=await s.api.POST(s.request({action:'claim'}));assert.equal(r.status,200);assert.equal(r.data.status,'CLAIMED');
 assert.ok(s.databaseCalls.some(q=>q.sql.includes('FOR UPDATE')));assert.equal(s.databaseCalls.at(-1).sql,'COMMIT');assert.equal(s.effects.at(-1).op,'claim');
});
test('replayed, delivered and reviewed orders cannot be claimed or used to send source',async()=>{
 for(const status of ['PROCESSING','DELIVERED','REVIEW_REQUIRED']){
  const s=setup({record:{...row,status}});assert.equal((await s.api.POST(s.request({action:'claim'}))).status,409);assert.equal(s.effects.length,0);
 }
 const s=setup();assert.equal((await s.api.POST(s.request({action:'source'}))).status,409);assert.equal(s.effects.length,0);
});
test('result is stored and read back before the shared result-ready transition',async()=>{
 const s=setup({record:{...row,status:'PROCESSING'}}),xlsxBase64=Buffer.from('PK\x03\x04synthetic-unit-test-only').toString('base64');
 const r=await s.api.POST(s.request({action:'result',xlsxBase64}));assert.equal(r.status,201);assert.equal(r.data.readBackVerified,true);
 assert.deepEqual(s.effects.map(e=>e.op),['put','head','get','result_ready']);
 const replay=setup({record:{...row,status:'PROCESSING',result_path:`results-v2/${id}/consolidated.xlsx`}});
 assert.equal((await replay.api.POST(replay.request({action:'result',xlsxBase64}))).status,409);assert.equal(replay.effects.length,0);
});
test('delivery requires durable result and receipt; review never requeues or resends',async()=>{
 const s=setup({record:{...row,status:'PROCESSING'}});
 assert.equal((await s.api.POST(s.request({action:'delivered',messageId:'1a179272ca7f00df'}))).status,409);assert.equal(s.effects.length,0);
 assert.equal((await s.api.POST(s.request({action:'review'}))).status,200);assert.deepEqual(s.effects.map(e=>e.op),['review']);
});
test('cleanup requires a final state and is restricted to the fixed synthetic paths',async()=>{
 const s=setup();assert.equal((await s.api.POST(s.request({action:'cleanup'}))).status,409);assert.equal(s.effects.length,0);
 const done=setup({record:{...row,status:'REVIEW_REQUIRED'}});done.seedBlobs();
 const r=await done.api.POST(done.request({action:'cleanup'}));assert.equal(r.status,200);assert.equal(r.data.cleanupVerified,true);
 assert.deepEqual(Array.from(done.effects[0].paths),[`intake-v2/${id}/file-001.pdf`,`intake-v2/${id}/manifest.json`,`results-v2/${id}/consolidated.xlsx`]);
});
test('provider errors do not expose raw provider messages, tokens or credentials',async()=>{
 const s=setup({blobFailure:true});const r=await s.api.POST(s.request({action:'prepare'}));assert.equal(r.status,503);
 assert.equal(r.data.error,'SYNTHETIC_E2E_UNAVAILABLE');assert.equal(JSON.stringify(r).includes('provider-secret'),false);assert.equal(s.databaseCalls.at(-1).sql,'ROLLBACK');
});
test('shared state functions reuse the supplied transaction client without opening an ambient Pool',async()=>{
 const api={},queries=[];
 vm.runInNewContext(compile('lib/paid-job-claim.ts'),{exports:api,process:{env:{}},require:()=>({Pool:class{constructor(){throw Error('Unexpected ambient database');}}})});
 const client={query:async(sql,args)=>{queries.push({sql,args});return {rowCount:1,rows:[row]};}};
 assert.equal((await api.claimPaidJob(id,client)).intake_id,id);
 assert.equal(await api.markResultReady(id,`results-v2/${id}/consolidated.xlsx`,client),true);
 assert.equal(await api.markDelivered(id,'synthetic-unit-receipt',client),true);
 assert.equal(await api.flagForReview(id,'SYNTHETIC_UNIT_FAILURE',client),true);
 assert.equal(queries.length,4);for(const q of queries)assert.equal(q.args[0],id);
});
