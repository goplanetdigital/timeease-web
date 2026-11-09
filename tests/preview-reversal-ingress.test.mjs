import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
let poolAttempts=0;
const env={VERCEL_ENV:'preview',TIMEEASE_ISOLATED_TEST_MODE:'true',TIMEEASE_V2_CHECKOUT_ENABLED:'false',TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'false',VERCEL_GIT_COMMIT_REF:'feature/isolated-worker-diagnostics-20261026',VERCEL_URL:'fixed-preview.vercel.app',TIMEEASE_TEST_ALLOWED_RECIPIENT:'jcaiworker@gmail.com',VERCEL_PROJECT_ID:'isolated-project',TIMEEASE_PREVIEW_PROJECT_ID:'isolated-project',TIMEEASE_TEST_WORKER_SECRET:'local-synthetic-bearer-no-live-key-123456'};
function load(path,cache=new Map()){
 path=resolve(path.replace(/\.ts$/,'')+'.ts');if(cache.has(path))return cache.get(path);const exports={};cache.set(path,exports);
 const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,process:{env},URL,Buffer,console,require:n=>n==='pg'?{Pool:class{constructor(){poolAttempts++;throw Error('NETWORK_FORBIDDEN');}}}:n==='next/server'?{NextResponse:{json:(b,o)=>Response.json(b,o)}}:n==='node:crypto'?crypto:n.startsWith('.')?load(resolve(dirname(path),n),cache):(()=>{throw Error('UNEXPECTED_IMPORT');})()});return exports;
}
const helper=load('lib/preview-shopify-reversal'),{POST}=load('app/api/test-worker/shopify-reversal/route');
function request(body=helper.reversalPayload('orders/cancelled'),headers={}){return new Request('https://fixed-preview.vercel.app/api/test-worker/shopify-reversal',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+env.TIMEEASE_TEST_WORKER_SECRET,'x-shopify-topic':'orders/cancelled','x-shopify-shop-domain':'preview.invalid','x-shopify-hmac-sha256':crypto.createHmac('sha256',helper.FIXTURE_SIGNING_KEY).update(body).digest('base64'),...headers},body});}
test('new Preview ingress remains closed in Production before body/DB access',async()=>{
 const prior=env.VERCEL_ENV;env.VERCEL_ENV='production';try{assert.equal((await POST(request())).status,404);}finally{env.VERCEL_ENV=prior;}assert.equal(poolAttempts,0);
});
test('new ingress requires both bearer authentication and raw fixture signature',async()=>{
 assert.equal((await POST(request(undefined,{authorization:'Bearer invalid'}))).status,401);
 assert.equal((await POST(request(undefined,{'x-shopify-hmac-sha256':'A'.repeat(43)+'='}))).status,401);assert.equal(poolAttempts,0);
});
test('even a correctly signed arbitrary order is refused before any connection',async()=>{
 const raw=JSON.stringify({id:'1033',test:false});assert.equal((await POST(request(raw))).status,422);assert.equal(poolAttempts,0);
});
test('fixed signed fixture reaches only the dedicated Preview connection boundary',async()=>{
 const r=await POST(request());assert.equal(r.status,503);assert.equal((await r.json()).error,'PREVIEW_PAYMENT_CONNECTION_REQUIRED');assert.equal(poolAttempts,0);
});
