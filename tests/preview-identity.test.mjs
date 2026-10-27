import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
const secret='synthetic-worker-test-value-with-32-characters';
const safe={role:'timeease_worker_limited',database:'neondb',branch_id:'br-rough-butterfly-aox5mukp',project_id:'odd-base-63790740',tls_active:true,tls_version:'TLSv1.3',elevated:false,neon_superuser_member:false,forbidden_write:false,can_select:true};
async function run(row,overrides={},authorized=true,cert=true,encrypted=true){
 let connections=0,queries=0;
 const exports={};
 const env={VERCEL_ENV:'preview',TIMEEASE_ISOLATED_TEST_MODE:'true',TIMEEASE_V2_CHECKOUT_ENABLED:'false',TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'false',TIMEEASE_TEST_WORKER_SECRET:secret,TIMEEASE_DB_DATABASE_URL:'postgresql://timeease_worker_limited:synthetic@ep-summer-salad-aoeax66z.c-2.ap-southeast-1.aws.neon.tech/neondb',...overrides};
 class Pool{async connect(){connections++;return {query:async()=>{queries++;return {rows:[row]};},connection:{stream:{authorized:cert,encrypted,getProtocol:()=>encrypted?'TLSv1.3':null}},release(){}};}async end(){}}
 vm.runInNewContext(ts.transpileModule(readFileSync('app/api/test-worker/db-identity/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,URL,process:{env},require:(name)=>name==='pg'?{Pool}:name==='node:crypto'?crypto:name==='next/server'?{NextResponse:{json:(data,options={})=>({data,status:options.status||200})}}:{isIsolatedPreview:e=>e.VERCEL_ENV==='preview'&&e.TIMEEASE_ISOLATED_TEST_MODE==='true'&&e.TIMEEASE_V2_CHECKOUT_ENABLED==='false'&&e.TIMEEASE_V2_PAYMENT_LEDGER_ENABLED==='false'}});
 const result=await exports.GET({headers:new Map(authorized?[['authorization','Bearer '+secret]]:[])});
 return {...result,connections,queries};
}
test('reject auth or non-isolated config before connecting',async()=>{
 const auth=await run(safe,{},false);assert.equal(auth.status,401);assert.equal(auth.connections,0);
 for(const overrides of [{VERCEL_ENV:'production'},{TIMEEASE_V2_CHECKOUT_ENABLED:'true'},{TIMEEASE_DB_DATABASE_URL:'postgresql://synthetic@production.example.com/neondb'}]){
  const r=await run(safe,overrides);assert.equal(r.status,503);assert.equal(r.connections,0);
 }
});
test('reject wrong actual identity, elevated permissions and unverified TLS',async()=>{
 for(const changes of [{branch_id:'wrong'},{project_id:'wrong'},{role:'neondb_owner'},{elevated:true},{neon_superuser_member:true},{forbidden_write:true},{can_select:false}])assert.equal((await run({...safe,...changes})).status,503);
 assert.equal((await run(safe,{},true,false)).status,503);
 assert.equal((await run(safe,{},true,true,false)).status,503);
});
test('safe query result succeeds and returns evidence',async()=>{
 const r=await run(safe);assert.equal(r.status,200);assert.equal(r.queries,1);assert.equal(r.data.tls.certificateVerified,true);assert.equal(r.data.leastPrivilege.neonSuperuserMember,false);
});

test('legacy worker URL is rejected before opening a connection',async()=>{
 const r=await run(safe,{TIMEEASE_DB_DATABASE_URL:'postgresql://timeease_test_worker:synthetic@ep-summer-salad-aoeax66z.c-2.ap-southeast-1.aws.neon.tech/neondb'});
 assert.equal(r.status,503);assert.equal(r.connections,0);
});

test('authenticated diagnostic records proxy backend TLS separately from verified client TLS',async()=>{
 const r=await run({...safe,tls_active:false});assert.equal(r.status,200);assert.equal(r.data.tls.active,true);assert.equal(r.data.tls.postgresBackendTlsReported,false);assert.equal(r.data.tls.scope,'client-to-neon');
});
