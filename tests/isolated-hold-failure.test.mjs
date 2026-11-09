import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const host='immutable-preview.vercel.app',secret='public-synthetic-'.repeat(3);
const env={VERCEL_ENV:'preview',VERCEL_URL:host,VERCEL_PROJECT_ID:'prj_Wx1x2G8gOdvuhZqHd8goSZyvQ077',VERCEL_GIT_COMMIT_REF:'feature/isolated-worker-diagnostics-20261026',TIMEEASE_ISOLATED_TEST_MODE:'true',TIMEEASE_V2_CHECKOUT_ENABLED:'false',TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'false',TIMEEASE_TEST_ALLOWED_RECIPIENT:'jcaiworker@gmail.com',TIMEEASE_PREVIEW_BLOB_STORE_ID:'store_FI8APVuc1xuRZkAg',TIMEEASE_TEST_WORKER_SECRET:secret,TIMEEASE_DB_DATABASE_URL:'postgresql://timeease_worker_limited:synthetic@ep-soft-morning-aokq5owy.c-2.ap-southeast-1.aws.neon.tech/neondb',TIMEEASE_PREVIEW_REVERSAL_DATABASE_URL:'postgresql://timeease_preview_reversal_20261108:synthetic@ep-soft-morning-aokq5owy.c-2.ap-southeast-1.aws.neon.tech/neondb'};
class NextResponse extends Response{static json(body,options={}){return new NextResponse(JSON.stringify(body),{...options,headers:{'content-type':'application/json',...options.headers}});}}
function modules(environment,extra={}){const cache=new Map();const load=path=>{
 path=resolve(path.replace(/\.ts$/,'')+'.ts');if(cache.has(path))return cache.get(path);const exports={};cache.set(path,exports);
 vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {exports,process:{env:environment},Buffer,URL,ReadableStream,TransformStream,console,require:n=>extra[n]??(n==='next/server'?{NextResponse}:n==='node:crypto'?crypto:n==='pg'?{Pool:class{constructor(){throw Error('NETWORK_FORBIDDEN');}}}:n==='@vercel/blob'?{}:n==='@vercel/oidc'?{getVercelOidcToken:async()=> 'public-synthetic'}:n.startsWith('.')?load(resolve(dirname(path),n)):(()=>{throw Error('IMPORT_FORBIDDEN');})())});return exports;
 };return load;}
function request(body,headers={}){const raw=JSON.stringify(body);return new Request(`https://${host}/api/test-worker/order-e2e`,{method:'POST',headers:{authorization:'Bearer '+secret,'content-type':'application/json',...headers},body:raw});}
const headers=kind=>{const raw=JSON.stringify({action:'hold',case:kind});return {'x-shopify-topic':kind==='cancelled'?'orders/cancelled':'refunds/create','x-shopify-shop-domain':'timeease-pr20-resume-20261109.myshopify.com','x-shopify-hmac-sha256':crypto.createHmac('sha256','timeease-preview-reversal-public-fixture-v1').update(raw).digest('base64')};};
test('new hold envelope requires exact case/topic/shop/signature before any connection',async()=>{
 const m=modules({...env})('lib/isolated-delivery-acceptance');
 assert.equal((await m.previewResumePOST(request({action:'hold',case:'delivery'},headers('delivery')))).status,400);
 assert.equal((await m.previewResumePOST(request({action:'hold',case:'cancelled'},{...headers('cancelled'),'x-shopify-hmac-sha256':'invalid'}))).status,401);
 assert.equal((await m.previewResumePOST(request({action:'hold',case:'refunded'},{...headers('refunded'),'x-shopify-topic':'orders/paid'}))).status,400);
 assert.equal((await m.previewResumePOST(request({action:'fail_before_send',case:'delivery'}))).status,400);
});
async function setup(){
 const d=new PGlite();await d.exec(readFileSync('tests/fixtures/v2-outbox-schema.sql','utf8')+`CREATE TABLE timeease_payment_holds(shop_domain text,shopify_order_id text,reason text,created_at timestamptz DEFAULT now(),PRIMARY KEY(shop_domain,shopify_order_id));`);
 let roleSwitches=0;const sessions=[];
 class Pool{constructor(options){this.login=new URL(options.connectionString).username;sessions.push(this.login);}async end(){}async connect(){const login=this.login;return {connection:{stream:{encrypted:true,authorized:true,getProtocol:()=> 'TLSv1.3'}},release(){},query:async(sql,args)=>{
  if(sql==='SET LOCAL ROLE timeease_payment_limited'){roleSwitches++;return {rows:[]};}
  if(sql.includes('AS database,session_user AS login'))return {rows:[{database:'neondb',login,project:'odd-base-63790740',branch:'br-restless-hill-ao5vpgb4'}]};
  if(sql.startsWith('SELECT current_user AS role,'))return {rows:[{role:'timeease_payment_limited',elevated:false,member:false,forbidden:false}]};
  if(sql.includes('AS database,current_user AS role'))return {rows:[{database:'neondb',role:'timeease_worker_limited',project:'odd-base-63790740',branch:'br-restless-hill-ao5vpgb4',elevated:false,member:false,forbidden:false}]};
  if(sql.includes('AS schema_ready'))return {rows:[{schema_ready:true,permissions_ready:true}]};
  const r=await d.query(sql,args);return {...r,rowCount:r.rowCount??r.affectedRows??r.rows.length};
 }};}}
 const load=modules({...env},{pg:{Pool}}),f=load('lib/isolated-delivery-fixtures'),m=load('lib/isolated-delivery-acceptance');
 for(const v of Object.values(f.RESUME_FIXTURES)){
  await d.query(`INSERT INTO timeease_v2_orders(intake_id,shopify_order_id,shopify_shop_domain,variant_id,amount_usd,customer_email,source_manifest_path,result_path,status,processing_attempts)VALUES($1,$2,$3,'synthetic-invoice',1,$4,$5,$6,'PROCESSING',1)`,[v.id,v.order,f.RESUME_SHOP,f.RESUME_EMAIL,`intake-v2/${v.id}/manifest.json`,`results-v2/${v.id}/consolidated.xlsx`]);
  await d.query('INSERT INTO timeease_fulfillment_outbox(intake_id,shopify_order_id) VALUES($1,$2)',[v.id,v.order]);
  await d.query("INSERT INTO timeease_delivery_ledger(delivery_id,intake_id,delivery_kind)VALUES($1,$2,'RESULT_EMAIL')",[crypto.randomUUID(),v.id]);
 }
 return {d,m,f,sessions,roleSwitches:()=>roleSwitches};
}
test('signed new cancellation/refund envelopes use existing login and limited role, persist holds and reject repeat mutation',async()=>{
 const {d,m,f,sessions,roleSwitches}=await setup();try{
  for(const kind of ['cancelled','refunded']){
   const r=await m.previewResumePOST(request({action:'hold',case:kind},headers(kind)));assert.equal(r.status,200);
   const b=await r.json();assert.equal(b.role,'timeease_payment_limited');assert.equal(b.signatureVerified,true);assert.equal(b.send,false);
   const row=(await d.query('SELECT status,processing_attempts FROM timeease_v2_orders WHERE intake_id=$1',[f.RESUME_FIXTURES[kind].id])).rows[0];assert.equal(row.status,'REVIEW_REQUIRED');assert.equal(row.processing_attempts,1);
   assert.equal((await m.previewResumePOST(request({action:'hold',case:kind},headers(kind)))).status,409);
  }
  assert.equal((await d.query('SELECT count(*)::int AS n FROM timeease_payment_holds')).rows[0].n,2);assert.equal(roleSwitches(),4);
  assert.equal(sessions.every(login=>login==='timeease_preview_reversal_20261108'),true);
 }finally{await d.close();}
});
test('new known-before-provider failure persists quarantine and never reclaims or accepts a delivery receipt',async()=>{
 const {d,m,f}=await setup();try{
  const claim=await m.previewResumePOST(request({action:'claim_delivery',case:'failure'}));assert.equal(claim.status,200);
  const failed=await m.previewResumePOST(request({action:'fail_before_send',case:'failure'}));assert.equal(failed.status,200);assert.equal((await failed.json()).noAutoRetry,true);
  const r=(await d.query('SELECT status,processing_attempts FROM timeease_v2_orders WHERE intake_id=$1',[f.RESUME_FIXTURES.failure.id])).rows[0];assert.equal(r.status,'REVIEW_REQUIRED');assert.equal(r.processing_attempts,1);
  const box=(await d.query('SELECT status,attempt_count,lease_until FROM timeease_fulfillment_outbox WHERE intake_id=$1',[f.RESUME_FIXTURES.failure.id])).rows[0];assert.equal(box.status,'FAILED');assert.equal(box.attempt_count,1);assert.equal(box.lease_until,null);
  assert.equal((await m.previewResumePOST(request({action:'claim_delivery',case:'failure'}))).status,409);
 }finally{await d.close();}
});
test('accepted download, worker identity and stable-alias guards are byte-identical; original three IDs remain exact',()=>{
 const path='lib/isolated-delivery-acceptance.ts',prior=execFileSync('git',['show','3edb7fd48ddf34f10cdfa1c4d93e3616208da052:'+path],{encoding:'utf8'}),now=readFileSync(path,'utf8');
 for(const [start,end]of [['export function resumeEnvironment','async function connection'],['async function connection','/** Fixed synthetic'],['export async function previewDeliveryArtifactGET','/** Fixture setup']])assert.equal(now.slice(now.indexOf(start),now.indexOf(end)),prior.slice(prior.indexOf(start),prior.indexOf(end)));
 const f='lib/isolated-delivery-fixtures.ts';const baseline=execFileSync('git',['show','3edb7fd48ddf34f10cdfa1c4d93e3616208da052:'+f],{encoding:'utf8'});
 assert.equal(readFileSync(f,'utf8').replace(",\n failure:{id:'03bcfb6f-5aeb-44c5-94fe-b1d12392ff78',order:'900000001109004'}",''),baseline);
});
