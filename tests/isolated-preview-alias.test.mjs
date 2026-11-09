import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
const alias='timeease-v2-secure-git-feature-isolate-3c280a-go-planet-digital.vercel.app';
const key='public-synthetic-test-'.repeat(3),sha='a'.repeat(40);
const env={VERCEL_ENV:'preview',VERCEL_URL:'immutable-preview.vercel.app',VERCEL_PROJECT_ID:'prj_Wx1x2G8gOdvuhZqHd8goSZyvQ077',VERCEL_GIT_COMMIT_SHA:sha,
 VERCEL_GIT_COMMIT_REF:'feature/isolated-worker-diagnostics-20261026',TIMEEASE_ISOLATED_TEST_MODE:'true',TIMEEASE_V2_CHECKOUT_ENABLED:'false',TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'false',TIMEEASE_TEST_ALLOWED_RECIPIENT:'jcaiworker@gmail.com',TIMEEASE_PREVIEW_BLOB_STORE_ID:'store_FI8APVuc1xuRZkAg',TIMEEASE_TEST_WORKER_SECRET:key};
let pools=0;
function modules(environment){const cache=new Map();const load=path=>{
 path=resolve(path.replace(/\.ts$/,'')+'.ts');if(cache.has(path))return cache.get(path);const exports={};cache.set(path,exports);
 vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {exports,process:{env:environment},Buffer,URL,Headers,console,require:n=>n==='next/server'?{NextResponse:{json:(body,options)=>({body,...options})}}:n==='pg'?{Pool:class{constructor(){pools++;throw Error('NETWORK_FORBIDDEN');}}}:n==='node:crypto'?crypto:n==='@vercel/blob'?{}:n==='@vercel/oidc'?{}:n.startsWith('.')?load(resolve(dirname(path),n)):(()=>{throw Error('IMPORT_FORBIDDEN');})()});return exports;
 };return load;}
const load=modules({...env}),h=load('lib/isolated-preview-alias'),m=load('lib/isolated-delivery-acceptance');
const req=(headers={})=>({url:`https://${alias}/api/worker/delivery-artifact?intakeId=not-a-fixed-order`,headers:new Headers({authorization:'Bearer '+key,...headers})});
test('only the exact pre-existing protected alias maps to canonical deployment host',()=>{
 assert.equal(h.canonicalPreviewHost(env,alias),env.VERCEL_URL);assert.equal(m.resumeEnvironment(env,alias),true);
 for(const wrong of ['untrusted.vercel.app','timeease-v2-secure.attacker.invalid',alias+'.attacker.invalid'])assert.equal(m.resumeEnvironment(env,wrong),false);
 assert.equal(m.resumeEnvironment({...env,VERCEL_PROJECT_ID:'other-project'},alias),false);
});
test('alias is denied on missing/malformed/stale SHA before database or storage',async()=>{
 for(const expected of [undefined,'invalid','b'.repeat(40)]){
  const headers=expected?{'x-timeease-preview-commit':expected}:{};
  assert.equal(h.previewAliasCommitMatches(env,alias,new Headers(headers)),false);
  const r=await m.previewDeliveryArtifactGET(req(headers));assert.equal(r.status,409);assert.equal(r.body.error,'PREVIEW_COMMIT_MISMATCH');
 }
 assert.equal(pools,0);
});
test('exact SHA still requires application auth and fixed IDs; Production never enters alias scope',async()=>{
 assert.equal(h.previewAliasCommitMatches(env,alias,new Headers({'x-timeease-preview-commit':sha})),true);
 const r=await m.previewDeliveryArtifactGET(req({'x-timeease-preview-commit':sha}));assert.equal(r.status,400);assert.equal(r.body.error,'EXACT_RESUME_FIXTURE_REQUIRED');
 const invalid=req({'x-timeease-preview-commit':sha});invalid.headers.set('authorization','Bearer invalid');assert.equal((await m.previewDeliveryArtifactGET(invalid)).status,401);
 const prod=modules({...env,VERCEL_ENV:'production'})('lib/isolated-delivery-acceptance');assert.equal((await prod.previewDeliveryArtifactGET(req({'x-timeease-preview-commit':sha}))).status,404);
 assert.equal(pools,0);
});
test('all accepted resume logic is identical after removing only alias mapping and SHA gate',()=>{
 const path='lib/isolated-delivery-acceptance.ts';const old=execFileSync('git',['show','2c17851aa8eae522793e8ba5231d25a982c31ad2:'+path],{encoding:'utf8'});
 const current=readFileSync(path,'utf8').replace("import {canonicalPreviewHost,previewAliasCommitMatches} from './isolated-preview-alias';\n",'').replace('previewOrderEnvironment(env,canonicalPreviewHost(env,host))','previewOrderEnvironment(env,host)').replace(" if(!previewAliasCommitMatches(process.env,new URL(req.url).hostname,req.headers))return reply({error:'PREVIEW_COMMIT_MISMATCH',send:false},409);\n",'');
 assert.equal(current,old);
});
