import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const secret='public-synthetic-preview-only-'.repeat(2),host='isolated-test.vercel.app';
const environment={VERCEL_ENV:'preview',VERCEL_URL:host,VERCEL_PROJECT_ID:'prj_Wx1x2G8gOdvuhZqHd8goSZyvQ077',
 VERCEL_GIT_COMMIT_REF:'feature/isolated-worker-diagnostics-20261026',TIMEEASE_ISOLATED_TEST_MODE:'true',
 TIMEEASE_V2_CHECKOUT_ENABLED:'false',TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'false',TIMEEASE_TEST_ALLOWED_RECIPIENT:'jcaiworker@gmail.com',
 TIMEEASE_TEST_WORKER_SECRET:secret,TIMEEASE_PREVIEW_BLOB_STORE_ID:'store_FI8APVuc1xuRZkAg',
 TIMEEASE_DB_DATABASE_URL:'postgresql://timeease_worker_limited:public-synthetic@ep-soft-morning-aokq5owy.c-2.ap-southeast-1.aws.neon.tech/neondb'};
class NextResponse extends Response{static json(body,options={}){return new NextResponse(JSON.stringify(body),{...options,headers:{'content-type':'application/json',...options.headers}});}}
function modules(env,extra={}){
 const cache=new Map();const load=path=>{
  path=resolve(path.replace(/\.ts$/,'')+'.ts');if(cache.has(path))return cache.get(path);const exports={};cache.set(path,exports);
  vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
   {exports,process:{env},Buffer,URL,ReadableStream,TransformStream,Request,Response,console,require:n=>extra[n]??(
    n==='next/server'?{NextRequest:Request,NextResponse}:n==='node:crypto'?crypto:n==='pg'?{Pool:class{constructor(){throw Error('NETWORK_FORBIDDEN');}}}:
    n==='@vercel/blob'?{}:n==='@vercel/oidc'?{getVercelOidcToken:async()=> 'public-synthetic-oidc'}:
    n.startsWith('.')?load(resolve(dirname(path),n)):(()=>{throw Error('UNEXPECTED_IMPORT:'+n);})())});return exports;
 };return load;
}
const getRequest=(id,auth=secret)=>new Request(`https://${host}/api/worker/delivery-artifact?intakeId=${id}`,{headers:{authorization:`Bearer ${auth}`}});
const postRequest=body=>new Request(`https://${host}/api/test-worker/order-e2e`,{method:'POST',headers:{authorization:`Bearer ${secret}`,'content-type':'application/json'},body:JSON.stringify(body)});
test('only exact Preview/project/host/store/flags are accepted; arbitrary and old IDs stop before database',async()=>{
 const load=modules({...environment}),m=load('lib/isolated-delivery-acceptance'),f=load('lib/isolated-delivery-fixtures');
 assert.equal(m.resumeEnvironment(environment,host),true);
 for(const patch of [{VERCEL_ENV:'production'},{VERCEL_PROJECT_ID:'other'},{TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'true'},{TIMEEASE_PREVIEW_BLOB_STORE_ID:'other'},{TIMEEASE_ISOLATED_TEST_MODE:'false'}])assert.equal(m.resumeEnvironment({...environment,...patch},host),false);
 assert.equal(m.resumeEnvironment(environment,'other.vercel.app'),false);
 assert.equal((await m.previewDeliveryArtifactGET(getRequest(f.RESUME_FIXTURES.delivery.id,'invalid'))).status,401);
 for(const id of ['1033','a1d26449-c4b5-4668-bffb-746ad257e708','00000000-0000-4000-8000-000000000001'])assert.equal((await m.previewDeliveryArtifactGET(getRequest(id))).status,400);
 assert.equal((await m.previewResumePOST(postRequest({case:'delivery',action:'stage',intakeId:'1033'}))).status,400);
 assert.equal((await m.previewResumePOST(postRequest({case:'delivery',action:'stage',padding:'a'.repeat(1100)}))).status,413);
});
test('Production handler and legacy adapter retain byte-identical behavior after isolated dispatch removal',()=>{
 for(const [file,importLine,dispatch]of[
  ['app/api/worker/delivery-artifact/route.ts',"import {previewDeliveryArtifactGET} from '../../../../lib/isolated-delivery-acceptance';\n"," if(process.env.VERCEL_ENV==='preview')return previewDeliveryArtifactGET(req);\n"],
  ['app/api/test-worker/order-e2e/route.ts',"import {previewResumePOST} from '../../../../lib/isolated-delivery-acceptance';\n"," if(req.headers.get('x-timeease-preview-resume')==='v1')return previewResumePOST(req);\n"]]){
  const prior=execFileSync('git',['show','66696c8996fa1fa9347377efa103df83562950e4:'+file],{encoding:'utf8'});
  assert.equal(readFileSync(file,'utf8').replace(importLine,'').replace(dispatch,''),prior);
 }
});
test('wrong endpoint and native TLS or database identity fail before any fixture or Blob access',async()=>{
 let pools=0,fixtureReads=0;
 const wrongEndpoint=modules({...environment,TIMEEASE_DB_DATABASE_URL:environment.TIMEEASE_DB_DATABASE_URL.replace('ep-soft-morning-aokq5owy','ep-wispy-butterfly-aootriqk')},
  {pg:{Pool:class{constructor(){pools++;throw Error('UNEXPECTED_CONNECTION');}}}})('lib/isolated-delivery-acceptance');
 assert.equal((await wrongEndpoint.previewDeliveryArtifactGET(getRequest('58e03e46-0331-414d-ab3c-9ba37ce613b1'))).status,503);assert.equal(pools,0);
 for(const [tls,identity]of [[false,{}],[true,{project:'wrong'}],[true,{branch:'br-wispy-river-aoo9eown'}],[true,{elevated:true}],[true,{role:'neondb_owner'}]]){
  const client={connection:{stream:{encrypted:tls,authorized:tls,getProtocol:()=> 'TLSv1.3'}},release(){},query:async sql=>{
   if(sql.includes('AS database,current_user AS role'))return {rows:[{database:'neondb',role:'timeease_worker_limited',project:'odd-base-63790740',branch:'br-restless-hill-ao5vpgb4',elevated:false,member:false,forbidden:false,...identity}]};
   if(sql.includes('timeease_v2_orders'))fixtureReads++;return {rows:[]};
  }};
  const m=modules({...environment},{pg:{Pool:class{async connect(){return client;}async end(){}}}})('lib/isolated-delivery-acceptance');
  assert.equal((await m.previewDeliveryArtifactGET(getRequest('58e03e46-0331-414d-ab3c-9ba37ce613b1'))).status,503);
 }
 assert.equal(fixtureReads,0);
});
async function setup(){
 const d=new PGlite();await d.exec(readFileSync('tests/fixtures/v2-outbox-schema.sql','utf8')+`CREATE TABLE timeease_payment_holds(shop_domain text,shopify_order_id text,reason text,created_at timestamptz DEFAULT now(),PRIMARY KEY(shop_domain,shopify_order_id));`);
 const blobs=new Map();let writes=0,reads=0;
 const client={connection:{stream:{encrypted:true,authorized:true,getProtocol:()=> 'TLSv1.3'}},release(){},query:async(sql,args)=>{
  if(sql.includes('AS database,current_user AS role'))return {rows:[{database:'neondb',role:'timeease_worker_limited',project:'odd-base-63790740',branch:'br-restless-hill-ao5vpgb4',elevated:false,member:false,forbidden:false}]};
  if(sql.includes('AS schema_ready'))return {rows:[{schema_ready:true,permissions_ready:true}]};
  const r=await d.query(sql,args);return {...r,rowCount:r.rowCount??r.affectedRows??r.rows.length};
 }};
 const load=modules({...environment},{pg:{Pool:class{async connect(){return client;}async end(){}}},'@vercel/blob':{
  put:async(path,value,options)=>{assert.equal(options.storeId,'store_FI8APVuc1xuRZkAg');assert.equal(options.allowOverwrite,false);if(blobs.has(path))throw Error('IMMUTABLE_OBJECT_EXISTS');writes++;blobs.set(path,{bytes:Buffer.from(value),type:options.contentType});},
  get:async path=>{reads++;const b=blobs.get(path);if(!b)return null;return {statusCode:200,stream:new ReadableStream({start(c){c.enqueue(b.bytes);c.close();}}),blob:{pathname:path,contentType:b.type,size:b.bytes.length}};}
 }});
 const m=load('lib/isolated-delivery-acceptance'),f=load('lib/isolated-delivery-fixtures');
 for(const fixture of Object.values(f.RESUME_FIXTURES))await d.query(`INSERT INTO timeease_v2_orders(intake_id,shopify_order_id,shopify_shop_domain,variant_id,amount_usd,customer_email,source_manifest_path)VALUES($1,$2,$3,'synthetic-invoice',1,$4,$5)`,[fixture.id,fixture.order,f.RESUME_SHOP,f.RESUME_EMAIL,`intake-v2/${fixture.id}/manifest.json`]);
 return {d,m,f,load,client,count:()=>({reads,writes})};
}
test('new synthetic stage -> stored XLSX GET is byte-identical and readonly; re-stage cannot reset it',async()=>{
 const {d,m,f,count}=await setup();try{
  assert.equal((await m.previewResumePOST(postRequest({case:'delivery',action:'stage'}))).status,200);
  const before=await d.query('SELECT to_jsonb(o) AS row FROM timeease_v2_orders o ORDER BY intake_id');
  const r=await m.previewDeliveryArtifactGET(getRequest(f.RESUME_FIXTURES.delivery.id));assert.equal(r.status,200);
  assert.equal(Buffer.from(await r.arrayBuffer()).toString('base64'),f.RESUME_XLSX_BASE64);
  const context=JSON.parse(Buffer.from(r.headers.get('x-timeease-artifact-context'),'base64url'));
  assert.equal(context.intakeId,f.RESUME_FIXTURES.delivery.id);assert.equal(context.customerEmail,f.RESUME_EMAIL);
  assert.equal((await m.previewResumePOST(postRequest({case:'delivery',action:'stage'}))).status,409);
  assert.deepEqual(await d.query('SELECT to_jsonb(o) AS row FROM timeease_v2_orders o ORDER BY intake_id'),before);assert.equal(count().writes,3);
 }finally{await d.close();}
});
test('cancel and refund persist holds and prevent artifact reads and claims on only their new fixtures',async()=>{
 const {d,m,f,load,client,count}=await setup();try{
  const hold=load('lib/payment-reversal').holdShopifyPayment;
  for(const [kind,reason]of [['cancelled','CANCELLED'],['refunded','REFUNDED']]){
   assert.equal((await m.previewResumePOST(postRequest({case:kind,action:'stage'}))).status,200);
   await client.query('BEGIN');await hold(f.RESUME_FIXTURES[kind].order,f.RESUME_SHOP,reason,client);await client.query('COMMIT');
   const before=count().reads;assert.equal((await m.previewDeliveryArtifactGET(getRequest(f.RESUME_FIXTURES[kind].id))).status,409);assert.equal(count().reads,before);
   const claim=await m.previewResumePOST(postRequest({case:kind,action:'claim_delivery'}));assert.equal(claim.status,409);assert.equal((await claim.json()).send,false);
  }
  assert.equal((await d.query('SELECT count(*)::int AS n FROM timeease_payment_holds')).rows[0].n,2);
 }finally{await d.close();}
});
test('one mock receipt closes new delivery; final XLSX reads/claims cannot authorize repeat delivery',async()=>{
 const {d,m,f}=await setup();try{
  await m.previewResumePOST(postRequest({case:'delivery',action:'stage'}));
  const claim=await (await m.previewResumePOST(postRequest({case:'delivery',action:'claim_delivery'}))).json();assert.equal(claim.outbox,'CLAIMED');assert.equal(claim.send,false);
  const receipt=await m.previewResumePOST(postRequest({case:'delivery',action:'mock_receipt',deliveryId:claim.deliveryId,messageId:claim.mockMessageId}));assert.equal(receipt.status,200);assert.equal((await receipt.json()).completed,true);
  const before=await d.query('SELECT to_jsonb(o) AS row FROM timeease_v2_orders o ORDER BY intake_id');
  assert.equal((await m.previewDeliveryArtifactGET(getRequest(f.RESUME_FIXTURES.delivery.id))).status,409);
  assert.equal((await m.previewResumePOST(postRequest({case:'delivery',action:'claim_delivery'}))).status,409);
  assert.deepEqual(await d.query('SELECT to_jsonb(o) AS row FROM timeease_v2_orders o ORDER BY intake_id'),before);
 }finally{await d.close();}
});
