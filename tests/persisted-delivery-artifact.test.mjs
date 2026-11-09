import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import * as crypto from 'node:crypto';
const id='43969572-c27f-4c83-a77c-68a2b8149e36';
const path=`results-v2/${id}/consolidated.xlsx`;
function moduleAt(file,imports={},env={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {exports,process:{env},URL,Buffer,ReadableStream,TransformStream,console,require:n=>{if(n in imports)return imports[n];throw Error('UNEXPECTED_IMPORT:'+n);}});
 return exports;
}
const {persistedDeliveryArtifact,XLSX_TYPE}=moduleAt('lib/persisted-delivery-artifact.ts');
const bytes=Uint8Array.from([80,75,3,4,7,8]);
const stream=(data=bytes)=>new ReadableStream({start(c){c.enqueue(data);c.close();}});
const blob=(extra={})=>({pathname:path,contentType:XLSX_TYPE,size:bytes.length,stream:stream(),...extra});
async function database(){
 const d=new PGlite();
 await d.exec(readFileSync('tests/fixtures/v2-outbox-schema.sql','utf8')+`CREATE TABLE timeease_payment_holds(shop_domain text,shopify_order_id text,reason text);`);
 await d.query(`INSERT INTO timeease_v2_orders(intake_id,shopify_order_id,shopify_shop_domain,variant_id,amount_usd,customer_email,source_manifest_path,result_path,status)
 VALUES($1,'synthetic-v20','preview.invalid','synthetic',1,'mock@example.invalid',$2,$3,'PROCESSING')`,[id,`intake-v2/${id}/manifest.json`,path]);
 await d.query(`INSERT INTO timeease_fulfillment_outbox(intake_id,shopify_order_id)VALUES($1,'synthetic-v20')`,[id]);
 await d.query(`INSERT INTO timeease_delivery_ledger(delivery_id,intake_id,delivery_kind)VALUES($1,$2,'RESULT_EMAIL')`,['445f42cc-0348-4fde-8db0-c2f3f4f02d91',id]);
 return d;
}
test('restart reads one persisted attachment with no conversion, upload or row mutation',async()=>{
 const d=await database();try{
  const before=await d.query('SELECT to_jsonb(o) AS row FROM timeease_v2_orders o');let opens=0;
  const a=await persistedDeliveryArtifact(id,d,async p=>{opens++;assert.equal(p,path);return blob();});
  assert.equal(opens,1);assert.equal(a.context.customerEmail,'mock@example.invalid');assert.equal(a.context.resultPath,path);
  assert.deepEqual(new Uint8Array(await new Response(a.stream).arrayBuffer()),bytes);
  assert.deepEqual(await d.query('SELECT to_jsonb(o) AS row FROM timeease_v2_orders o'),before);
 }finally{await d.close();}
});
test('new artifact read cannot expose held, terminal, already-attempted or uncertain deliveries',async()=>{
 const d=await database();try{
  let opens=0;const open=async()=>{opens++;return blob();};
  const rejected=async()=>assert.equal(await persistedDeliveryArtifact(id,d,open),null);
  await d.exec("INSERT INTO timeease_payment_holds VALUES('preview.invalid','synthetic-v20','REFUNDED')");await rejected();
  await d.exec('DELETE FROM timeease_payment_holds');
  for(const status of ['DELIVERED','REVIEW_REQUIRED']){await d.query('UPDATE timeease_v2_orders SET status=$1',[status]);await rejected();}
  await d.exec("UPDATE timeease_v2_orders SET status='PROCESSING'");
  await d.exec('UPDATE timeease_fulfillment_outbox SET attempt_count=1');await rejected();
  await d.exec("UPDATE timeease_fulfillment_outbox SET attempt_count=0; UPDATE timeease_delivery_ledger SET status='UNKNOWN'");await rejected();
  assert.equal(opens,0);
 }finally{await d.close();}
});
test('malformed metadata and truncated, oversized or non-XLSX streams fail before claim',async()=>{
 const fake={query:async()=>({rows:[{intake_id:id,customer_email:'mock@example.invalid',result_path:path}]})};
 for(const extra of [{pathname:'results-v2/other/consolidated.xlsx'},{contentType:'text/html'},{size:0},{size:20971521}])
  assert.equal(await persistedDeliveryArtifact(id,fake,async()=>blob(extra)),null);
 for(const extra of [{size:5},{size:7},{stream:stream(Uint8Array.from([1,2,3,4,7,8]))}]){
  const a=await persistedDeliveryArtifact(id,fake,async()=>blob(extra));
  await assert.rejects(new Response(a.stream).arrayBuffer(),/PERSISTED_ARTIFACT/);
 }
});
test('new route stays closed in Preview and rejects invalid auth or caller-selected paths before DB',async()=>{
 let enabled=false,db=0;const env={};
 const route=moduleAt('app/api/worker/delivery-artifact/route.ts',{
  'next/server':{NextResponse:{json:(body,options)=>({body,...options})}},'node:crypto':crypto,
  pg:{Pool:class{constructor(){db++;throw Error('DB_FORBIDDEN');}}},'@vercel/blob':{},
  '../../../../lib/production-release':{productionSendEnabled:()=>enabled},
  '../../../../lib/production-database':{},'../../../../lib/blob-access':{blobAccessConfigured:()=>true},
  '../../../../lib/preview-blob-guard':{previewBlobAccessBlocked:()=>false},
  '../../../../lib/persisted-delivery-artifact':{},
 },env);
 const result=await route.GET({headers:{get(){throw Error('READ_BEFORE_GATE');}}});assert.equal(result.status,503);assert.equal(db,0);
 enabled=true;
 const noSecret=await route.GET({headers:{get:()=>''}});assert.equal(noSecret.status,503);assert.equal(db,0);
 env.TIMEEASE_V2_WORKER_SECRET='public-synthetic-'.repeat(3);
 assert.equal((await route.GET({headers:{get:()=>''}})).status,401);
 const headers={get:()=>`Bearer ${env.TIMEEASE_V2_WORKER_SECRET}`};
 for(const query of [`intakeId=${id}&path=other`,`intakeId=${id}&intakeId=${id}`,'intakeId=invalid'])
  assert.equal((await route.GET({headers,url:'https://example.invalid/?'+query})).status,400);
 assert.equal(db,0);
});
