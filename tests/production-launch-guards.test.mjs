import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const claim={};vm.runInNewContext(compile('lib/paid-job-claim.ts'),{exports:claim,process:{env:{}},require:()=>({Pool:class{constructor(){throw Error('Unexpected ambient database');}}})});
const readiness={};vm.runInNewContext(compile('lib/checkout-readiness.ts'),{exports:readiness});
const id='123e4567-e89b-42d3-a456-426614174000';
const path=`results-v2/${id}/consolidated.xlsx`;
const receipt='1a179272ca7f00df';

function client(handler){
 const calls=[];
 return {calls,query:async(sql,args)=>{calls.push({sql,args});return handler(sql,args,calls);}};
}

test('same stored result is idempotent and a second reservation does not permit another send',async()=>{
 const stored={status:'PROCESSING',result_path:null,delivery_message_id:null,last_error:null};
 const db=client((sql)=>{
  if(sql.startsWith('UPDATE')&&sql.includes('result_path=$2')){
   if(stored.result_path)return {rowCount:0,rows:[]};
   stored.result_path=path;return {rowCount:1,rows:[{intake_id:id}]};
  }
  if(sql.startsWith('SELECT status,result_path FROM'))return {rowCount:1,rows:[stored]};
  if(sql.startsWith('UPDATE')&&sql.includes('last_error=$2')){
   if(stored.last_error)return {rowCount:0,rows:[]};
   stored.last_error=claim.DELIVERY_RESERVATION;return {rowCount:1,rows:[{intake_id:id}]};
  }
  return {rowCount:1,rows:[stored]};
 });
 assert.equal(await claim.markResultReady(id,path,db),true);
 assert.equal(await claim.markResultReady(id,path,db),true);
 assert.equal(await claim.reserveDelivery(id,db),'RESERVED');
 assert.equal(await claim.reserveDelivery(id,db),'ALREADY_RESERVED');
 assert.equal(await claim.reserveDelivery(id,client(()=>({rowCount:0,rows:[{status:'PAID',result_path:null,delivery_message_id:null,last_error:null}]}))),'NOT_RESERVABLE');
});

test('delivery requires one Gmail id and replays the same receipt without another update',async()=>{
 await assert.rejects(()=>claim.completeReservedDelivery(id,'sent',client(()=>{throw Error('no query');})),/INVALID_DELIVERY_RECEIPT/);
 const reserved={status:'PROCESSING',result_path:path,delivery_message_id:null,last_error:claim.DELIVERY_RESERVATION};
 const db=client(sql=>{
  if(sql.startsWith('UPDATE')&&sql.includes("status='DELIVERED'")){
   reserved.status='DELIVERED';reserved.delivery_message_id=receipt;reserved.last_error=null;
   return {rowCount:1,rows:[{intake_id:id}]};
  }
  return {rowCount:1,rows:[reserved]};
 });
 assert.equal(await claim.completeReservedDelivery(id,receipt,db),'DELIVERED');
 assert.equal(await claim.completeReservedDelivery(id,receipt,db),'IDEMPOTENT');
 const bare=client(()=>({rowCount:1,rows:[{status:'PROCESSING',result_path:path,delivery_message_id:null,last_error:null}]}));
 assert.equal(await claim.completeReservedDelivery(id,receipt,bare),'REJECTED');
 assert.equal(bare.calls.some(call=>call.sql.includes("status='DELIVERED'")),false);
});

test('production launch stays blocked without live webhook and worker proof',()=>{
 const names=['SHOPIFY_PAID_WEBHOOK_UNVERIFIED','PRODUCTION_WORKER_EXACTLY_ONCE_UNVERIFIED'];
 const preview=readiness.productionLaunchBlockers({VERCEL_ENV:'preview',TIMEEASE_ISOLATED_TEST_MODE:'true'},false);
 assert.equal(preview.includes('PREVIEW_ISOLATION'),true);
 for(const name of names)assert.equal(preview.includes(name),true);
 const configured={
  VERCEL_ENV:'production',TIMEEASE_V2_CHECKOUT_ENABLED:'true',TIMEEASE_V2_DELIVERY_VERIFIED:'true',
  TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'true',TIMEEASE_DB_DATABASE_URL:'configured',BLOB_READ_WRITE_TOKEN:'configured',
  SHOPIFY_WEBHOOK_SECRET:'configured',TIMEEASE_CHECKOUT_BINDING_SECRET:'configured',SHOPIFY_SHOP_DOMAIN:'example.myshopify.com',
  TIMEEASE_V2_WORKER_SECRET:'synthetic-worker-test-value-with-32-characters'
 };
 const ready=readiness.productionLaunchBlockers(configured,true);
 assert.equal(ready.length,names.length);
 for(const name of names)assert.equal(ready.includes(name),true);
 assert.equal(ready.length===0,false);
});
