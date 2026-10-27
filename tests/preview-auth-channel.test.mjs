import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
const compile=(p,jsx=false)=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS,...(jsx?{jsx:ts.JsxEmit.ReactJSX}:{})}}).outputText;
const guards={};vm.runInNewContext(compile('lib/test-worker-guards.ts'),{exports:guards});
const fixtures={};vm.runInNewContext(compile('lib/preview-order-fixture.ts'),{exports:fixtures,Buffer,require:()=>guards});
const nonce='0b2c8a21-53c4-4f98-8694-b348e173f65c';
const env={VERCEL_ENV:'preview',VERCEL_URL:'preview.example.vercel.app',VERCEL_GIT_COMMIT_REF:fixtures.PREVIEW_ORDER_BRANCH,
 VERCEL_GIT_COMMIT_SHA:'unit-synthetic-commit',TIMEEASE_ISOLATED_TEST_MODE:'true',TIMEEASE_V2_CHECKOUT_ENABLED:'false',
 TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'false',TIMEEASE_TEST_ALLOWED_RECIPIENT:fixtures.TEST_RECIPIENT,
 TIMEEASE_TEST_WORKER_SECRET:'unit-synthetic-credential-not-a-real-secret',BLOB_READ_WRITE_TOKEN:'unit-forbidden-inherited-token'};
const next={NextRequest:Request,NextResponse:{json:(data,options)=>Response.json(data,options)}};
function setup(overrides={},upstream){
 let external=0,delegated=0;const worker={},controller={},options={...env,...overrides};
 const deny=()=>{external++;throw Error('Forbidden external operation');};
 vm.runInNewContext(compile('app/api/test-worker/order-e2e/route.ts'),{exports:worker,process:{env:options},URL,Buffer,
  require:name=>name==='next/server'?next:name==='node:crypto'?crypto:name==='pg'?{Pool:class{constructor(){deny();}}}:
   name==='@vercel/blob'?{get:deny,put:deny,head:deny,del:deny,list:deny}:name.endsWith('preview-order-fixture')?fixtures:
   name.endsWith('paid-job-claim')?{claimPaidJob:deny,markResultReady:deny,markDelivered:deny,flagForReview:deny}:{previewBlobOptions:deny}});
 vm.runInNewContext(compile('app/api/preview-worker-auth-check/route.ts'),{exports:controller,process:{env:options},URL,URLSearchParams,Buffer,
  require:name=>name==='next/server'?next:name.endsWith('preview-order-fixture')?fixtures:{POST:async req=>{
   delegated++;assert.equal(new URL(req.url).hostname,env.VERCEL_URL);
   assert.equal(req.headers.get('authorization'),`Bearer ${options.TIMEEASE_TEST_WORKER_SECRET}`);
   const b=await req.clone().json();assert.deepEqual(b,{action:'auth_check',nonce});
   return upstream?upstream(req):worker.POST(req);
  }}});
 const form=(changes={},host=env.VERCEL_URL,body=`confirm=preview-auth-check-only&nonce=${nonce}`)=>new Request(`https://${host}/api/preview-worker-auth-check`,{
  method:'POST',headers:{origin:`https://${env.VERCEL_URL}`,'sec-fetch-site':'same-origin','content-type':'application/x-www-form-urlencoded',...changes},body});
 const probe=(body={action:'auth_check',nonce},authorization=`Bearer ${options.TIMEEASE_TEST_WORKER_SECRET}`)=>new Request(`https://${env.VERCEL_URL}/api/test-worker/order-e2e`,{
  method:'POST',headers:{'content-type':'application/json',authorization},body:JSON.stringify(body)});
 return {worker,controller,form,probe,external:()=>external,delegated:()=>delegated};
}
test('authenticated auth_check exits before any database, Blob or state operation without DB configuration',async()=>{
 const s=setup(),r=await s.worker.POST(s.probe()),b=await r.json();assert.equal(r.status,200);assert.equal(b.authenticated,true);
 assert.equal(b.requestNonce,nonce);for(const k of ['databaseAccessed','blobAccessed','ordersTouched','emailSent'])assert.equal(b[k],false);
 assert.equal(s.external(),0);assert.equal(JSON.stringify(b).includes(env.TIMEEASE_TEST_WORKER_SECRET),false);
});
test('auth_check still requires the original Bearer and cannot accept business inputs',async()=>{
 const s=setup();assert.equal((await s.worker.POST(s.probe(undefined,''))).status,401);
 for(const b of [{action:'auth_check'},{action:'auth_check',nonce,case:'delivery'},{action:'auth_check',nonce,intakeId:'1033'},{action:'auth_check',nonce:'invalid'}])
  assert.equal((await s.worker.POST(s.probe(b))).status,400);
 assert.equal(s.external(),0);
});
test('operator POST uses the real existing Bearer verifier in-process and labels its limited proof',async()=>{
 const s=setup(),r=await s.controller.POST(s.form()),b=await r.json();assert.equal(r.status,200);assert.equal(s.delegated(),1);assert.equal(s.external(),0);
 assert.equal(b.authenticated,true);assert.equal(b.requestNonce,nonce);assert.equal(b.externalWorkerHttpVerified,false);
 assert.equal(b.transport,'protected-browser-post-with-in-process-bearer-verification');assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal(JSON.stringify(b).includes(env.TIMEEASE_TEST_WORKER_SECRET),false);
});
test('Production, development, other branches and enabled payment flags cannot use either probe',async()=>{
 for(const change of [{VERCEL_ENV:'production'},{VERCEL_ENV:'development'},{VERCEL_GIT_COMMIT_REF:'main'},
  {TIMEEASE_V2_CHECKOUT_ENABLED:'true'},{TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'true'},{TIMEEASE_TEST_ALLOWED_RECIPIENT:'customer@example.com'}]){
  const s=setup(change);assert.equal((await s.controller.POST(s.form())).status,404);assert.equal((await s.worker.POST(s.probe())).status,404);
  assert.equal(s.delegated(),0);assert.equal(s.external(),0);
 }
 const s=setup();assert.equal((await s.controller.POST(s.form({},'timeease-ruby.vercel.app'))).status,404);assert.equal(s.delegated(),0);
});
test('foreign or missing origin/site and wrong content type fail before delegation',async()=>{
 for(const change of [{origin:'https://foreign.example'},{origin:''},{'sec-fetch-site':'cross-site'},{'sec-fetch-site':''},{'content-type':'application/json'}]){
  const s=setup();assert.notEqual((await s.controller.POST(s.form(change))).status,200);assert.equal(s.delegated(),0);assert.equal(s.external(),0);
 }
});
test('form cannot select an action, endpoint, order, credential or duplicate nonce',async()=>{
 for(const body of [`confirm=preview-auth-check-only&nonce=${nonce}&action=claim`,`confirm=preview-auth-check-only&nonce=${nonce}&target=production`,
  `confirm=preview-auth-check-only&nonce=${nonce}&token=synthetic`,`confirm=preview-auth-check-only&nonce=${nonce}&nonce=${nonce}`,
  `confirm=wrong&nonce=${nonce}`,`confirm=preview-auth-check-only&nonce=invalid`]){
  const s=setup();assert.equal((await s.controller.POST(s.form({},undefined,body))).status,400);assert.equal(s.delegated(),0);
 }
});
test('oversized declared and streamed bodies are bounded and never delegated',async()=>{
 for(const req of [()=>setup().form({'content-length':'999'}),()=>setup().form({},undefined,'x'.repeat(257))]){
  const s=setup();assert.equal((await s.controller.POST(req())).status,400);assert.equal(s.delegated(),0);
 }
});
test('missing Preview credential has no fallback to old Worker or Blob credentials',async()=>{
 const s=setup({TIMEEASE_TEST_WORKER_SECRET:undefined,TIMEEASE_V2_WORKER_SECRET:env.TIMEEASE_TEST_WORKER_SECRET});
 const r=await s.controller.POST(s.form());assert.equal(r.status,503);assert.equal(s.delegated(),0);assert.equal(s.external(),0);
 assert.equal((await r.json()).error,'TEST_AUTH_MISSING');
});
test('upstream failure bodies and exceptions never leak credential values',async()=>{
 for(const upstream of [async()=>Response.json({secret:env.TIMEEASE_TEST_WORKER_SECRET},{status:401}),async()=>{throw Error(env.TIMEEASE_TEST_WORKER_SECRET);}]){
  const s=setup({},upstream),r=await s.controller.POST(s.form());assert.equal(r.status,503);assert.equal((await r.text()).includes(env.TIMEEASE_TEST_WORKER_SECRET),false);
 }
});
test('probe rejects mismatched scope/nonce/effects instead of accepting a generic HTTP 200',async()=>{
 for(const b of [{authenticated:true},{authenticated:true,scope:'other'},{authenticated:true,scope:'auth-check-only',databaseAccessed:true}]){
  const s=setup({},async()=>Response.json(b));const r=await s.controller.POST(s.form());assert.equal(r.status,503);
  assert.equal((await r.json()).error,'AUTH_PROBE_UNEXPECTED_RESPONSE');
 }
});
test('page renders only a fixed POST form, with a public correlation nonce and no credential',async()=>{
 const page={};const jsx=(type,props)=>({type,props});
 vm.runInNewContext(compile('app/preview-worker-auth-check/page.tsx',true),{exports:page,process:{env},require:name=>
  name==='next/headers'?{headers:async()=>new Headers({host:env.VERCEL_URL})}:name==='next/navigation'?{notFound:()=>{throw Error('404');}}:
  name==='node:crypto'?{randomUUID:()=>nonce}:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:fixtures});
 const tree=await page.default();const serialized=JSON.stringify(tree);assert.equal(serialized.includes(env.TIMEEASE_TEST_WORKER_SECRET),false);
 const children=tree.props.children,form=children.find(c=>c.type==='form');assert.equal(form.props.method,'post');assert.equal(form.props.action,'/api/preview-worker-auth-check');
 assert.equal(form.props.children[1].props.value,nonce);
});
