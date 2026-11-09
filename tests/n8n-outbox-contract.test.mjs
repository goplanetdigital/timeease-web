import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeOneDelivery,boundReceiptReport,exceptionCounts} from '../lib/n8n-outbox-contract.mjs';
const now=1800000000000,id='30ddfe75-a571-4baa-b2d5-5b4ecf963304',deliveryId='fdcb1ded-9aad-4226-957e-bbc3938f4483';
const good=()=>({expected:{intakeId:id,attachmentIntakeId:id,resultPath:`results-v2/${id}/consolidated.xlsx`,customerEmail:'synthetic@example.invalid'},response:{statusCode:200,body:{ok:true,send:true,outbox:'CLAIMED',intakeId:id,deliveryId,leaseUntil:new Date(now+300000).toISOString()}}});
test('sender boundary binds one order, attachment, delivery UUID and positive lease',()=>{
 const item=good(),c=authorizeOneDelivery([item],now);assert.equal(c.intakeId,id);assert.equal(c.deliveryId,deliveryId);
 const report=boundReceiptReport(c,{id:'abcdef0123456789'});assert.deepEqual(report,{intakeId:id,action:'delivered',deliveryId,messageId:'abcdef0123456789'});
 assert.throws(()=>authorizeOneDelivery([],now),/EXACTLY_ONE/);assert.throws(()=>authorizeOneDelivery([good(),good()],now),/EXACTLY_ONE/);
});
test('sender boundary rejects redirects, HTML, duplicate/uncertain claims, cross-order attachment and expired leases',()=>{
 const cases=[x=>x.response.statusCode=302,x=>x.response.body='<html>SSO</html>',x=>x.response.body.ok=false,
 x=>x.response.body.send=false,x=>x.response.body.outbox='IN_FLIGHT',x=>x.response.body.intakeId=deliveryId,
 x=>x.expected.attachmentIntakeId=deliveryId,x=>x.response.body.deliveryId='missing',
 x=>x.response.body.leaseUntil=new Date(now-1).toISOString(),x=>x.response.body.leaseUntil=new Date(now+30000).toISOString(),
 x=>x.response.body.leaseUntil=new Date(now+600001).toISOString(),x=>x.response.body.leaseUntil=null];
 for(const mutate of cases){const item=good();mutate(item);assert.throws(()=>authorizeOneDelivery([item],now));}
 assert.throws(()=>boundReceiptReport(authorizeOneDelivery([good()],now),{id:123456789012}),/BOUND_GMAIL/);
});
test('monitor checks Outbox/UNKNOWN/expiry counters and fails closed on unreachable or malformed data',()=>{
 const response={statusCode:200,body:{ledgerReachable:true,expiredLeases:2,outbox:[{status:'FAILED',count:1}],deliveryLedger:[{status:'UNKNOWN',count:3}]}};
 assert.deepEqual(exceptionCounts(response),{expiredLeases:2,unknown:3,failed:1});
 assert.throws(()=>exceptionCounts({statusCode:503,body:{}}),/MONITOR_UNAVAILABLE/);
 response.body.expiredLeases='2';assert.throws(()=>exceptionCounts(response),/MONITOR_COUNT/);
});
