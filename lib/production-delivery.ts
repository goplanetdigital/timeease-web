import {randomUUID} from 'node:crypto';
import {publishV2Result,claimV2Outbox,completeV2Outbox,recoverV2Outbox,failV2OutboxBeforeSend,inspectV2Outbox} from './v2-delivery-outbox';
import {quarantineOrderDelivery} from './payment-reversal';
import type {TransactionClient} from './production-database';
export type DeliveryReport={intakeId:string;action:string;resultPath?:string;deliveryId?:string;messageId?:string};
type Result={status:number;body:Record<string,unknown>};
// Runs only inside the caller's scoped transaction/order lock. No sender here.
export async function reportProductionDelivery(b:DeliveryReport,client:TransactionClient,held:boolean,
 sendEnabled:boolean,verifyResult:(path:string)=>Promise<boolean>):Promise<Result>{
 const reject=(error:string,status=409):Result=>({status,body:{error,send:false}});
 if(b.action==='result_ready'){
  const path=`results-v2/${b.intakeId}/consolidated.xlsx`;
  if(held)return reject('PAYMENT_HELD');
  if(b.resultPath!==path)return reject('INVALID_RESULT_PATH',400);
  if(!await verifyResult(path))return reject('RESULT_NOT_STORED');
  const outbox=await publishV2Result(b.intakeId,path,randomUUID(),client);
  return {status:outbox==='NOT_READY'?409:200,body:{ok:outbox!=='NOT_READY',outbox,send:false}};
 }
 if(b.action==='outbox_claim'){
  if(held||!sendEnabled)return reject(held?'PAYMENT_HELD':'SEND_DISABLED');
  const outbox=await claimV2Outbox(b.intakeId,client),claimed=outbox==='CLAIMED';
  const pair=await inspectV2Outbox(b.intakeId,client);
  const lease=claimed?await client.query('SELECT lease_until FROM public.timeease_fulfillment_outbox WHERE intake_id=$1',[b.intakeId]):null;
  if(claimed&&!lease?.rows[0]?.lease_until)throw Error('OUTBOX_LEASE_REQUIRED');
  return {status:claimed?200:409,body:{ok:claimed,outbox,send:claimed,intakeId:b.intakeId,
   deliveryId:pair.ledger?.delivery_id,leaseUntil:lease?.rows[0]?.lease_until??null}};
 }
 if(b.action==='delivered'){
  if(typeof b.deliveryId!=='string'||typeof b.messageId!=='string'||!/^[a-f0-9]{10,64}$/i.test(b.messageId))return reject('BOUND_PROVIDER_RECEIPT_REQUIRED',400);
  const pair=await inspectV2Outbox(b.intakeId,client);
  if(pair.ledger?.delivery_id!==b.deliveryId)return reject('DELIVERY_ID_MISMATCH');
  if(held)return reject('PAYMENT_HELD_MANUAL_RECEIPT_REVIEW');
  const state=await completeV2Outbox(b.intakeId,b.messageId,client);
  return {status:state==='REJECTED'?409:200,body:{ok:state!=='REJECTED',idempotent:state==='IDEMPOTENT',send:false}};
 }
 if(b.action==='recover'||b.action==='failed_before_send'){
  const ok=b.action==='recover'?await recoverV2Outbox(b.intakeId,client):await failV2OutboxBeforeSend(b.intakeId,client);
  return {status:ok?200:409,body:{ok,send:false,noAutoRetry:true}};
 }
 if(b.action==='review'){
  const state=await quarantineOrderDelivery(b.intakeId,'DELIVERY_UNCERTAIN_NO_AUTO_RESEND',client);
  return {status:state==='HELD'?200:409,body:{ok:state==='HELD',send:false,noAutoRetry:true}};
 }
 return reject('OUTBOX_ACTION_REQUIRED',400);
}
