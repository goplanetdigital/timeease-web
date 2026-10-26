import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const env={VERCEL_ENV:'preview',TIMEEASE_ISOLATED_TEST_MODE:'true',TIMEEASE_V2_CHECKOUT_ENABLED:'false',TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'false',TIMEEASE_PREVIEW_BLOB_STORE_ID:'store_FI8APVuc1xuRZkAg',VERCEL_OIDC_TOKEN:'synthetic-oidc',BLOB_READ_WRITE_TOKEN:'synthetic-inherited-production',TIMEEASE_DB_DATABASE_URL:'postgresql://timeease_worker_limited:synthetic@ep-summer-salad-aoeax66z.c-2.ap-southeast-1.aws.neon.tech/neondb'};
const safe={role:'timeease_worker_limited',database:'neondb',project_id:'odd-base-63790740',branch_id:'br-rough-butterfly-aox5mukp',read_only:true,tls_active:true,elevated:false,neon_superuser_member:false,can_select:true,forbidden_write:false};
async function run(overrides={},row=safe,cert=true,listFails=false,contextOidc=false){
 const queries=[],lists=[],configs=[];
 class Pool{constructor(config){configs.push(config);}async connect(){return {query:async sql=>{queries.push(sql);return {rows:[row]};},connection:{stream:{authorized:cert}},release(){}};}async end(){}}
 const exports={},guards={};vm.runInNewContext(compile('lib/test-worker-guards.ts'),{exports:guards});
 vm.runInNewContext(compile('lib/preview-runtime-evidence.ts'),{exports,URL,AbortSignal,require:name=>name==='pg'?{Pool}:name==='@vercel/oidc'?{getVercelOidcToken:async()=>{if(!contextOidc&&!({...env,...overrides}).VERCEL_OIDC_TOKEN)throw Error('OIDC unavailable');return 'synthetic-oidc';}}:name==='@vercel/blob'?{list:async options=>{lists.push(options);if(listFails)throw Error('provider error');return {blobs:[]};}}:guards});
 return {result:await exports.previewRuntimeEvidence({...env,...overrides}),queries,lists,configs};
}
test('readiness uses verified native TLS and explicit Preview OIDC store without inherited token',async()=>{
 const r=await run();assert.equal(r.queries[0],'BEGIN READ ONLY');assert.equal(r.queries.at(-1),'ROLLBACK');
 assert.equal(new URL(r.configs[0].connectionString).searchParams.get('sslmode'),'verify-full');
 assert.equal(r.lists[0].storeId,env.TIMEEASE_PREVIEW_BLOB_STORE_ID);
 assert.equal('token' in r.lists[0],false);assert.equal('oidcToken' in r.lists[0],false);
 for(const [key,value] of Object.entries(r.result.database))if(key!=='status')assert.equal(value,true);
 assert.equal(r.result.database.status,'VERIFIED');
 assert.equal(r.result.blob.readVerified,true);assert.equal(r.result.blob.productionTokenUsed,false);assert.equal(r.result.blob.writeVerified,false);
 assert.equal(JSON.stringify(r.result).includes('synthetic'),false);
});
test('non-isolated configuration opens no connection or Blob request',async()=>{
 for(const overrides of [{VERCEL_ENV:'production'},{TIMEEASE_V2_CHECKOUT_ENABLED:'true'},{TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'true'}]){
  const r=await run(overrides);assert.equal(r.configs.length,0);assert.equal(r.lists.length,0);
 }
});
test('missing OIDC or wrong store never falls back to shared read-write token',async()=>{
 for(const overrides of [{VERCEL_OIDC_TOKEN:''},{TIMEEASE_PREVIEW_BLOB_STORE_ID:'store_2zPRAZaFbo6bhEfz'}]){
  const r=await run(overrides);assert.equal(r.lists.length,0);assert.equal(r.result.blob.readVerified,false);
 }
 const r=await run({},safe,true,true);assert.equal(r.lists.length,1);assert.equal(r.result.blob.readVerified,false);
});
test('runtime evidence rejects wrong URL before connecting and reports actual identity/TLS failures',async()=>{
 const bad=await run({TIMEEASE_DB_DATABASE_URL:'postgresql://owner:synthetic@production.example/neondb'});assert.equal(bad.configs.length,0);
 assert.equal((await run({},safe,false)).result.database.tlsCertificateVerified,false);
 assert.equal((await run({},{...safe,branch_id:'wrong'})).result.database.identityVerified,false);
 assert.equal((await run({},{...safe,elevated:true})).result.database.leastPrivilegeVerified,false);
});

test('OIDC available through request context works without a process token variable',async()=>{
 const r=await run({VERCEL_OIDC_TOKEN:''},safe,true,false,true);assert.equal(r.result.blob.oidcConfigured,true);assert.equal(r.result.blob.readVerified,true);assert.equal('token' in r.lists[0],false);
});
