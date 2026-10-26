import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const guard={};
vm.runInNewContext(compile('lib/preview-blob-guard.ts'),{exports:guard});
test('shared Blob remains closed in Preview even when configuration flags are enabled',()=>{
 assert.equal(guard.previewBlobAccessBlocked({VERCEL_ENV:'preview',TIMEEASE_ISOLATED_TEST_MODE:'true',TIMEEASE_V2_CHECKOUT_ENABLED:'true'}),true);
 for(const value of ['production','development',undefined])assert.equal(guard.previewBlobAccessBlocked({VERCEL_ENV:value}),false);
});
for(const [path,method] of [['intake','POST'],['checkout','POST'],['webhooks/shopify','POST'],['worker/manifest','GET'],['worker/source','GET'],['worker/result','POST'],['worker/report','POST']]){
 test(`${path} blocks Preview before request parsing, database and Blob access`,async()=>{
  let sideEffects=0;
  const fail=()=>{sideEffects++;throw Error('Unexpected external access');};
  const exports={};
  const response={json:(data,options)=>({data,...options})};
  vm.runInNewContext(compile(`app/api/${path}/route.ts`),{exports,process:{env:{VERCEL_ENV:'preview'}},require:name=>name.endsWith('preview-blob-guard')?guard:name==='next/server'?{NextResponse:response}:name==='@vercel/blob'?{get:fail,put:fail,del:fail,head:fail}:name==='pg'?{Pool:class{constructor(){fail();}}}:{} });
  const request=new Proxy({}, {get:fail});
  const result=await exports[method](request);
  assert.equal(result.status,503);
  assert.equal(result.data.error,'PREVIEW_BLOB_ISOLATION_REQUIRED');
  assert.equal(result.headers['Cache-Control'],'no-store');
  assert.equal(sideEffects,0);
 });
}

test('readiness reports Preview intake blocked despite an inherited storage token',async()=>{
 const exports={};
 vm.runInNewContext(compile('app/api/readiness/route.ts'),{exports,process:{env:{VERCEL_ENV:'preview',BLOB_READ_WRITE_TOKEN:'synthetic-only'}},require:name=>name.endsWith('preview-blob-guard')?guard:name.endsWith('preview-runtime-evidence')?{previewRuntimeEvidence:async()=>({readOnly:true})}:name==='next/server'?{NextResponse:{json:data=>data}}:name.endsWith('payment-ledger-schema-ready')?{paymentLedgerSchemaReady:async()=>false}:{checkoutIsEnabled:()=>false,checkoutTestPrerequisitesReady:()=>false}});
 const result=await exports.GET();
 assert.equal(result.privateStorageConfigured,true);
 assert.equal(result.intakeEnabled,false);
 assert.equal(result.previewBlobAccessBlocked,true);
 assert.equal(result.launchReady,false);
});
