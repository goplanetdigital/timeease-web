import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS}}).outputText;
const guards={};vm.runInNewContext(compile('lib/test-worker-guards.ts'),{exports:guards});
const fixtures={};vm.runInNewContext(compile('lib/preview-order-fixture.ts'),{exports:fixtures,Buffer,require:()=>guards});
const nonce='0b2c8a21-53c4-4f98-8694-b348e173f65c';
const env={VERCEL_ENV:'preview',VERCEL_URL:'preview.example.vercel.app',VERCEL_GIT_COMMIT_REF:fixtures.PREVIEW_ORDER_BRANCH,
 VERCEL_GIT_COMMIT_SHA:'synthetic-local-only',TIMEEASE_ISOLATED_TEST_MODE:'true',TIMEEASE_V2_CHECKOUT_ENABLED:'false',
 TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'false',TIMEEASE_TEST_ALLOWED_RECIPIENT:fixtures.TEST_RECIPIENT,
 TIMEEASE_TEST_WORKER_SECRET:'synthetic-unit-test-value-never-live'};
function setup(overrides={},upstream=async()=>Response.json({synthetic:true,productionTokenUsed:false,prepared:true,intakeId:fixtures.ORDER_FIXTURES.delivery})){
 const api={},calls=[];
 vm.runInNewContext(compile('app/api/preview-order-console/route.ts'),{exports:api,process:{env:{...env,...overrides}},URL,URLSearchParams,Buffer,
  require:name=>name==='next/server'?{NextRequest:Request,NextResponse:{json:(b,o)=>Response.json(b,o)}}:
   name.endsWith('preview-order-fixture')?fixtures:{POST:async req=>{calls.push(req);return upstream(req);}}});
 const request=(fields={},headers={},host=env.VERCEL_URL)=>new Request(`https://${host}/api/preview-order-console`,{
  method:'POST',headers:{origin:`https://${env.VERCEL_URL}`,'sec-fetch-site':'same-origin','content-type':'application/x-www-form-urlencoded',...headers},
  body:new URLSearchParams({confirm:'preview-fixed-order-only',nonce,action:'prepare',case:'delivery',payload:'',receiptReviewed:'no',...fields}).toString()});
 return {api,calls,request};
}
test('console rejects Production, wrong branch, aliases, payment flags and recipient before delegation',async()=>{
 for(const o of [{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},{TIMEEASE_V2_CHECKOUT_ENABLED:'true'},
  {TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'true'},{TIMEEASE_TEST_ALLOWED_RECIPIENT:'customer@example.com'}]){
  const s=setup(o);assert.equal((await s.api.POST(s.request())).status,404);assert.equal(s.calls.length,0);
 }
 const s=setup();assert.equal((await s.api.POST(s.request({}, {},'timeease-ruby.vercel.app'))).status,404);assert.equal(s.calls.length,0);
});
test('console rejects missing/foreign origin, site and unsupported type without delegating',async()=>{
 for(const h of [{origin:''},{origin:'https://foreign.example'},{'sec-fetch-site':'cross-site'},{'content-type':'application/json'}]){
  const s=setup();assert.ok([403,415].includes((await s.api.POST(s.request({},h))).status));assert.equal(s.calls.length,0);
 }
});
test('no arbitrary action, ID, recipient, credential, URL, or recovery of delivery fixture',async()=>{
 for(const f of [{action:'pay'},{case:'1033'},{intakeId:'1033'},{recipient:'customer@example.com'},
  {token:'synthetic'},{target:'https://production.example'},{action:'recover'},{nonce:'bad'},{payload:'unexpected'}]){
  const s=setup();assert.equal((await s.api.POST(s.request(f))).status,400);assert.equal(s.calls.length,0);
 }
});
test('duplicate fields and both declared and actual over-limit bodies fail before delegation',async()=>{
 const s=setup();const original=s.request();
 const duplicate=new Request(original.url,{method:'POST',headers:original.headers,body:(await original.text())+'&case=failure'});
 assert.equal((await s.api.POST(duplicate)).status,400);
 assert.equal((await s.api.POST(s.request({}, {'content-length':'2000001'}))).status,413);
 assert.equal((await s.api.POST(s.request({payload:'x'.repeat(2000001)}))).status,413);assert.equal(s.calls.length,0);
});
test('successful delegation is fixed-target, existing Bearer only, response whitelist excludes raw provider fields',async()=>{
 const s=setup({},async()=>Response.json({synthetic:true,productionTokenUsed:false,prepared:true,intakeId:fixtures.ORDER_FIXTURES.delivery,secret:env.TIMEEASE_TEST_WORKER_SECRET}));
 const r=await s.api.POST(s.request()),b=await r.json();assert.equal(r.status,200);assert.equal(s.calls.length,1);
 const req=s.calls[0];assert.equal(req.url,`https://${env.VERCEL_URL}/api/test-worker/order-e2e`);
 assert.equal(req.headers.get('authorization'),`Bearer ${env.TIMEEASE_TEST_WORKER_SECRET}`);
 assert.deepEqual(await req.json(),{action:'prepare',case:'delivery'});assert.equal(b.emailSent,false);assert.equal(b.externalWorkerHttpVerified,false);
 assert.equal(b.requestNonce,nonce);assert.equal(JSON.stringify(b).includes(env.TIMEEASE_TEST_WORKER_SECRET),false);
});
test('missing test credential has no legacy credential fallback',async()=>{
 const s=setup({TIMEEASE_TEST_WORKER_SECRET:undefined,TIMEEASE_V2_WORKER_SECRET:env.TIMEEASE_TEST_WORKER_SECRET});
 assert.equal((await s.api.POST(s.request())).status,503);assert.equal(s.calls.length,0);
});
test('delivered needs operator acknowledgement and bounded current-run receipt; failure fixture cannot deliver',async()=>{
 for(const fields of [{action:'delivered',payload:'abc123def456'},{action:'delivered',receiptReviewed:'yes',payload:'bad'},
  {action:'delivered',case:'failure',receiptReviewed:'yes',payload:'abc123def456'}]){
  const s=setup();assert.equal((await s.api.POST(s.request(fields))).status,400);assert.equal(s.calls.length,0);
 }
 const s=setup({},async()=>Response.json({synthetic:true,productionTokenUsed:false,delivered:true,providerReceiptRequiresExternalVerification:true}));
 assert.equal((await s.api.POST(s.request({action:'delivered',receiptReviewed:'yes',payload:'abc123def456'}))).status,200);
 assert.equal((await s.calls[0].json()).messageId,'abc123def456');
});
test('generic 200, production token use, leaked error body and thrown errors never become acceptance',async()=>{
 for(const fn of [async()=>Response.json({ok:true}),async()=>Response.json({synthetic:true,productionTokenUsed:true}),
  async()=>Response.json({error:env.TIMEEASE_TEST_WORKER_SECRET},{status:409}),async()=>{throw Error(env.TIMEEASE_TEST_WORKER_SECRET);}]){
  const s=setup({},fn),r=await s.api.POST(s.request());assert.ok([409,503].includes(r.status));assert.equal((await r.text()).includes(env.TIMEEASE_TEST_WORKER_SECRET),false);
 }
});
test('result rejects noncanonical/over-limit data, records only original adapter verification',async()=>{
 for(const payload of ['?', 'x'.repeat(1400001)]){const s=setup();assert.equal((await s.api.POST(s.request({action:'result',payload}))).status,400);assert.equal(s.calls.length,0);}
 const payload=Buffer.from('PK\x03\x04synthetic-only').toString('base64');
 const s=setup({},async()=>Response.json({synthetic:true,productionTokenUsed:false,resultReady:true,readBackVerified:true},{status:201}));
 assert.equal((await s.api.POST(s.request({action:'result',payload}))).status,201);assert.equal((await s.calls[0].json()).xlsxBase64,payload);
});
test('scoped recovery cannot query delivery or arbitrary orders and never opens an ambient database',async()=>{
 const api={},queries=[];
 vm.runInNewContext(compile('lib/preview-order-recovery.ts'),{exports:api,require:name=>{
  assert.ok(name.endsWith('preview-order-fixture'));return fixtures;
 }});
 const client={query:async(sql,args)=>{queries.push({sql,args});return {rowCount:0};}};
 for(const id of ['1033',fixtures.ORDER_FIXTURES.delivery])await assert.rejects(api.recoverPreviewFailure(id,client),/FAILURE_FIXTURE_REQUIRED/);
 assert.equal(queries.length,0);assert.equal(await api.recoverPreviewFailure(fixtures.ORDER_FIXTURES.failure,client),false);
 const q=queries[0];assert.deepEqual(Array.from(q.args),[fixtures.ORDER_FIXTURES.failure]);
 assert.match(q.sql,/WHERE intake_id=\$1 AND status='PROCESSING'/);assert.match(q.sql,/processing_started_at < now\(\) - interval '10 minutes'/);
 assert.match(q.sql,/SET status='REVIEW_REQUIRED'/);assert.match(q.sql,/MANUAL_REVIEW_NO_AUTO_RESEND/);
 assert.equal(await api.recoverPreviewFailure(fixtures.ORDER_FIXTURES.failure,{query:async()=>({rowCount:1})}),true);
});
