import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';

// New key-selection boundary only: no network, TLS, SQL or old fixtures.
function loadModule(path,cache=new Map()){
 path=resolve(path.replace(/\.ts$/,'')+'.ts');if(cache.has(path))return cache.get(path);
 const exports={};cache.set(path,exports);
 const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,process:{env:{}},URL,Buffer,console,require:name=>
  name==='pg'?{Pool:class{constructor(){throw Error('NETWORK_FORBIDDEN');}}}:
  name==='node:crypto'||name==='crypto'?crypto:
  name.startsWith('.')?loadModule(resolve(dirname(path),name),cache):(()=>{throw Error('UNEXPECTED_IMPORT');})()});
 return exports;
}
const {productionConnection}=loadModule('lib/production-database');
const release={VERCEL_ENV:'production',VERCEL_PROJECT_ID:'prj_2w1jB9WzF64hLNb6jRDxQw3LGSKR',
 VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),TIMEEASE_RELEASE_COMMIT_SHA:'a'.repeat(40),TIMEEASE_V2_OUTBOX_ENABLED:'true'};
const payment='postgresql://timeease_payment_limited:public-synthetic@ep-test.neon.tech/neondb?sslmode=verify-full';
const worker=payment.replace('timeease_payment_limited','timeease_worker_limited');
test('new payment URL is required even when the legacy shared URL exists',()=>{
 assert.throws(()=>productionConnection('payment',{...release,TIMEEASE_DB_DATABASE_URL:payment}),/NOT_CONFIGURED/);
 const env={...release,TIMEEASE_PAYMENT_DATABASE_URL:payment,TIMEEASE_DB_DATABASE_URL:'postgresql://neondb_owner:public-synthetic@ep-other.neon.tech/neondb'};
 const prior=JSON.stringify(env);assert.equal(productionConnection('payment',env),payment);assert.equal(JSON.stringify(env),prior);
});
test('purpose-specific payment and worker keys cannot substitute for each other',()=>{
 assert.throws(()=>productionConnection('worker',{...release,TIMEEASE_PAYMENT_DATABASE_URL:payment}),/NOT_CONFIGURED/);
 assert.throws(()=>productionConnection('payment',{...release,TIMEEASE_WORKER_DATABASE_URL:worker}),/NOT_CONFIGURED/);
 assert.throws(()=>productionConnection('payment',{...release,TIMEEASE_PAYMENT_DATABASE_URL:worker}),/SCOPE_REQUIRED/);
});
