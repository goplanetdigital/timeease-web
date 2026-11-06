import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
const compile=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS}}).outputText;
const guards={};vm.runInNewContext(compile('lib/test-worker-guards.ts'),{exports:guards});
const fixtures={};vm.runInNewContext(compile('lib/preview-order-fixture.ts'),{exports:fixtures,Buffer,require:()=>guards});
const diagnostic={};vm.runInNewContext(compile('lib/worker-database-url.ts'),{exports:diagnostic,URL});
const nonce='0b2c8a21-53c4-4f98-8694-b348e173f65c';
const secret='unit-synthetic-worker-secret-32chars';
const password='synthetic-url-password-not-real';
const valid=`postgresql://timeease_worker_limited:${password}@example.internal/neondb`;
const env={VERCEL_ENV:'preview',VERCEL_URL:'preview.example.vercel.app',VERCEL_GIT_COMMIT_REF:fixtures.PREVIEW_ORDER_BRANCH,
 TIMEEASE_ISOLATED_TEST_MODE:'true',TIMEEASE_V2_CHECKOUT_ENABLED:'false',TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'false',
 TIMEEASE_TEST_ALLOWED_RECIPIENT:fixtures.TEST_RECIPIENT,TIMEEASE_V2_WORKER_SECRET:secret};
const next={NextRequest:Request,NextResponse:{json:(data,options)=>Response.json(data,options)}};
function setup(overrides={}){
 let pools=0;
 const options={...env,...overrides},route={};
 vm.runInNewContext(compile('app/api/preview-worker-url-diagnostic/route.ts'),{exports:route,process:{env:options},URL,URLSearchParams,Buffer,
  require:name=>name==='next/server'?next:name==='node:crypto'?crypto:name.endsWith('preview-order-fixture')?fixtures:name.endsWith('worker-database-url')?diagnostic:name==='pg'?{Pool:class{constructor(){pools++;throw Error('database connection forbidden');}}}:{}});
 const get=(authorization=`Bearer ${secret}`,host=options.VERCEL_URL)=>new Request(`https://${host}/api/preview-worker-url-diagnostic`,{headers:{authorization}});
 const form=(body=`confirm=preview-worker-url-diagnostic-only&nonce=${nonce}`,host=options.VERCEL_URL)=>new Request(`https://${host}/api/preview-worker-url-diagnostic`,{
  method:'POST',headers:{origin:`https://${options.VERCEL_URL}`,'sec-fetch-site':'same-origin','content-type':'application/x-www-form-urlencoded'},body});
 return {route,get,form,pools:()=>pools};
}
function hidden(body){
 const text=JSON.stringify(body);
 assert.equal(text.includes(password),false);
 assert.equal(text.includes('example.internal'),false);
 assert.equal(text.includes(secret),false);
}
function fields(result,expected){
 for(const [key,value] of Object.entries(expected))assert.equal(result[key],value);
}
test('missing dedicated Worker URL does not use the ledger URL',()=>{
 const result=diagnostic.diagnoseDedicatedWorkerDatabaseUrl(undefined);
 fields(result,{dedicatedUrlPresent:false,urlParsed:false,postgresProtocol:false,usernameMatchesLimitedRole:false,passwordPresent:false,code:'WORKER_DATABASE_URL_MISSING'});
 const ignored=diagnostic.diagnoseDedicatedWorkerDatabaseUrl('');
 assert.equal(ignored.code,'WORKER_DATABASE_URL_MISSING');
});
test('malformed, passwordless, and valid synthetic URLs return only structure',()=>{
 const malformed=diagnostic.diagnoseDedicatedWorkerDatabaseUrl('not a url');
 assert.equal(malformed.dedicatedUrlPresent,true);assert.equal(malformed.urlParsed,false);assert.equal(malformed.code,'WORKER_DATABASE_URL_MALFORMED');
 const passwordless=diagnostic.diagnoseDedicatedWorkerDatabaseUrl('postgresql://timeease_worker_limited@example.internal/neondb');
 assert.equal(passwordless.postgresProtocol,true);assert.equal(passwordless.usernameMatchesLimitedRole,true);
 assert.equal(passwordless.passwordPresent,false);assert.equal(passwordless.code,'WORKER_DATABASE_PASSWORD_MISSING');
 const empty=diagnostic.diagnoseDedicatedWorkerDatabaseUrl('postgresql://timeease_worker_limited:@example.internal/neondb');
 assert.equal(empty.code,'WORKER_DATABASE_PASSWORD_MISSING');
 const query=diagnostic.diagnoseDedicatedWorkerDatabaseUrl(`postgresql://timeease_worker_limited@example.internal/neondb?password=${encodeURIComponent(password)}`);
 assert.equal(query.passwordPresent,true);assert.equal(query.code,'WORKER_DATABASE_URL_ACCEPTED');hidden(query);
 const undecodable=diagnostic.diagnoseDedicatedWorkerDatabaseUrl('postgresql://timeease_worker_limited:%ZZ@example.internal/neondb');
 assert.equal(undecodable.passwordPresent,false);assert.equal(undecodable.code,'WORKER_DATABASE_PASSWORD_MISSING');
 assert.equal(JSON.stringify(undecodable).includes('%ZZ'),false);
 const accepted=diagnostic.diagnoseDedicatedWorkerDatabaseUrl(valid);
 fields(accepted,{dedicatedUrlPresent:true,urlParsed:true,postgresProtocol:true,usernameMatchesLimitedRole:true,passwordPresent:true,code:'WORKER_DATABASE_URL_ACCEPTED'});
 hidden(accepted);
});
test('authenticated diagnostic reads only the dedicated URL and never opens a pool',async()=>{
 const s=setup({TIMEEASE_WORKER_DATABASE_URL:valid,TIMEEASE_DB_DATABASE_URL:'postgresql://neondb_owner:other-secret@production.example/neondb'});
 const response=await s.route.GET(s.get()),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.code,'WORKER_DATABASE_URL_ACCEPTED');assert.equal(s.pools(),0);hidden(body);
 const missing=setup({TIMEEASE_DB_DATABASE_URL:valid});
 const missingBody=await (await missing.route.GET(missing.get())).json();
 assert.equal(missingBody.code,'WORKER_DATABASE_URL_MISSING');assert.equal(missing.pools(),0);
});
test('authentication failure does not reveal URL structure',async()=>{
 const s=setup({TIMEEASE_WORKER_DATABASE_URL:valid});
 for(const authorization of ['',`Bearer ${'x'.repeat(32)}`,'Bearer short']){
  const response=await s.route.GET(s.get(authorization)),body=await response.json();
  assert.equal(response.status,401);assert.equal(body.error,'UNAUTHORIZED');hidden(body);
 }
 assert.equal(s.pools(),0);
});
test('ledger flag does not hide the dedicated URL structure',async()=>{
 const s=setup({TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'true',TIMEEASE_WORKER_DATABASE_URL:valid});
 const response=await s.route.GET(s.get()),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.code,'WORKER_DATABASE_URL_ACCEPTED');assert.equal(s.pools(),0);hidden(body);
});
test('Production and other environments are rejected before URL inspection',async()=>{
 for(const change of [{VERCEL_ENV:'production'},{VERCEL_ENV:'development'},{VERCEL_GIT_COMMIT_REF:'main'}]){
  const s=setup({...change,TIMEEASE_WORKER_DATABASE_URL:valid});
  const bearer=await s.route.GET(s.get()),form=await s.route.POST(s.form());
  assert.equal(bearer.status,404);assert.equal((await bearer.json()).error,'PREVIEW_TEST_ONLY');
  assert.equal(form.status,404);assert.equal(s.pools(),0);hidden(await form.json());
 }
});
test('protected form returns the same whitelist and keeps the bearer inside the process',async()=>{
 const s=setup({TIMEEASE_WORKER_DATABASE_URL:'postgresql://timeease_worker_limited@example.internal/neondb'});
 const response=await s.route.POST(s.form()),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.code,'WORKER_DATABASE_PASSWORD_MISSING');assert.equal(body.passwordPresent,false);
 assert.deepEqual(Object.keys(body).sort(),['code','dedicatedUrlPresent','passwordPresent','postgresProtocol','urlParsed','usernameMatchesLimitedRole']);
 hidden(body);assert.equal(s.pools(),0);
 const foreign=setup({TIMEEASE_WORKER_DATABASE_URL:valid});
 assert.equal((await foreign.route.POST(foreign.form(`confirm=preview-worker-url-diagnostic-only&nonce=${nonce}`,'timeease-ruby.vercel.app'))).status,404);
});
