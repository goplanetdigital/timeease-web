import type {TransactionClient} from './production-database';
export const XLSX_TYPE='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const MAX_DELIVERY_BYTES=20*1024*1024;
export type StoredArtifact={stream:ReadableStream<Uint8Array>;pathname:string;contentType:string;size:number};
/** Read only. A later Outbox claim remains the sole authority to send. */
export async function persistedDeliveryArtifact(id:string,client:TransactionClient,open:(path:string)=>Promise<StoredArtifact|null>){
 const result=await client.query(`SELECT o.intake_id,o.customer_email,o.result_path FROM public.timeease_v2_orders o
  JOIN public.timeease_fulfillment_outbox b ON b.intake_id=o.intake_id AND b.shopify_order_id=o.shopify_order_id
  JOIN public.timeease_delivery_ledger l ON l.intake_id=o.intake_id AND l.delivery_kind='RESULT_EMAIL'
  WHERE o.intake_id=$1 AND o.status='PROCESSING' AND o.delivery_message_id IS NULL AND o.last_error IS NULL
  AND o.source_manifest_path='intake-v2/'||o.intake_id::text||'/manifest.json'
  AND b.status='PENDING' AND b.attempt_count=0 AND b.lease_until IS NULL
  AND l.status='PENDING' AND l.attempt_number=0 AND l.provider_message_id IS NULL
  AND NOT EXISTS(SELECT 1 FROM public.timeease_payment_holds h
   WHERE h.shop_domain=o.shopify_shop_domain AND h.shopify_order_id=o.shopify_order_id)`,[id]);
 const row=result.rows[0],path=`results-v2/${id}/consolidated.xlsx`;
 if(result.rows.length!==1||row.intake_id!==id||row.result_path!==path||typeof row.customer_email!=='string'||
  row.customer_email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.customer_email))return null;
 const artifact=await open(path);
 if(!artifact)return null;
 if(artifact.pathname!==path||artifact.contentType!==XLSX_TYPE||!Number.isSafeInteger(artifact.size)||artifact.size<4||artifact.size>MAX_DELIVERY_BYTES){
  await artifact.stream.cancel().catch(()=>{});return null;
 }
 const context={intakeId:id,attachmentIntakeId:id,resultPath:path,customerEmail:row.customer_email,bytes:artifact.size};
 let received=0;const prefix:number[]=[];
 const checked=artifact.stream.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({
  transform(chunk,controller){
   received+=chunk.byteLength;
   if(received>artifact.size)throw Error('PERSISTED_ARTIFACT_SIZE_MISMATCH');
   for(const byte of chunk){if(prefix.length===4)break;prefix.push(byte);}
   if(prefix.length===4&&prefix.join(',')!=='80,75,3,4')throw Error('PERSISTED_ARTIFACT_NOT_XLSX');
   controller.enqueue(chunk);
  },
  flush(){if(received!==artifact.size||prefix.length!==4)throw Error('PERSISTED_ARTIFACT_SIZE_MISMATCH');}
 }));
 return {context,stream:checked};
}
