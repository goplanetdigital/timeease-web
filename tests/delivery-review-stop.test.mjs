import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const claim={};
vm.runInNewContext(compile('lib/paid-job-claim.ts'),{exports:claim,process:{env:{}},require:()=>({Pool:class{constructor(){throw new Error('Unexpected ambient database');}}})});
const id='123e4567-e89b-42d3-a456-426614174000';
const path=`results-v2/${id}/consolidated.xlsx`;
const receipt='1a179272ca7f00df';

function memory(){
 const row={status:'PROCESSING',result_path:path,delivery_message_id:null,last_error:null};
 const updates=[];
 const client={updates,query:async(sql,args)=>{
  updates.push(sql);
  if(sql.includes("status='DELIVERED'")){
   if(row.status!=='PROCESSING'||!row.result_path||row.delivery_message_id)return {rowCount:0,rows:[]};
   row.status='DELIVERED';row.delivery_message_id=args[1];row.last_error=null;
   return {rowCount:1,rows:[{intake_id:id}]};
  }
  if(sql.includes("SET last_error=$2")&&sql.includes("last_error IS NULL")){
   if(row.status!=='PROCESSING'||row.last_error||row.delivery_message_id||!row.result_path)return {rowCount:0,rows:[]};
   row.last_error=args[1];
   return {rowCount:1,rows:[{intake_id:id}]};
  }
  if(sql.includes("status='REVIEW_REQUIRED'")){
   if(row.status!=='PROCESSING')return {rowCount:0,rows:[]};
   row.status='REVIEW_REQUIRED';row.last_error=args[1];
   return {rowCount:1,rows:[{intake_id:id}]};
  }
  return {rowCount:1,rows:[row]};
 }};
 return {row,client};
}

test('a repeated reservation stops sending and moves the order to review',async()=>{
 const state=memory();
 assert.equal(await claim.reserveDelivery(id,state.client),'RESERVED');
 assert.equal(state.row.status,'PROCESSING');
 assert.equal(await claim.reserveDelivery(id,state.client),'ALREADY_RESERVED');
 assert.equal(state.row.status,'REVIEW_REQUIRED');
 assert.equal(state.row.last_error,claim.REVIEW_ALREADY_RESERVED);
 assert.equal(await claim.reserveDelivery(id,state.client),'NOT_RESERVABLE');
 assert.equal(state.client.updates.some(sql=>sql.includes("status='DELIVERED'")),false);
});

test('an unclear Gmail receipt is reviewed and a valid receipt can be stored once',async()=>{
 const unclear=memory();
 unclear.row.last_error=claim.DELIVERY_RESERVATION;
 assert.equal(await claim.reviewUnconfirmedReceipt(id,unclear.client),true);
 assert.equal(unclear.row.status,'REVIEW_REQUIRED');
 assert.equal(unclear.row.last_error,claim.REVIEW_UNCONFIRMED_RECEIPT);
 assert.equal(unclear.client.updates.some(sql=>sql.includes("status='DELIVERED'")),false);
 const ready=memory();
 ready.row.last_error=claim.DELIVERY_RESERVATION;
 assert.equal(await claim.completeReservedDelivery(id,receipt,ready.client),'DELIVERED');
 assert.equal(ready.row.delivery_message_id,receipt);
 assert.equal(await claim.completeReservedDelivery(id,receipt,ready.client),'IDEMPOTENT');
});
