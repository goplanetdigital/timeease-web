import type {PoolClient} from 'pg';
import {markResultReady,markDelivered} from './paid-job-claim';

// Caller owns BEGIN / COMMIT / ROLLBACK on this exact client. No ambient Pool,
// network, email sender, clock override, privilege escalation or queue-wide scan.
type Client=Pick<PoolClient,'query'>;
type Order={intake_id:string;shopify_order_id:string;status:string;result_path:string|null;
 delivery_message_id:string|null;last_error:string|null;source_manifest_path:string};
type Outbox={intake_id:string;shopify_order_id:string;status:string;attempt_count:number;expired:boolean|null};
type Ledger={delivery_id:string;intake_id:string;delivery_kind:string;status:string;
 provider_message_id:string|null;attempt_number:number};
export const OUTBOX_RESERVED='OUTBOX_DELIVERY_RESERVED_NO_AUTO_RESEND';

export async function requireV2OutboxSchema(client:Client):Promise<void>{
 const q=await client.query<{schema_ready:boolean;permissions_ready:boolean}>(`SELECT
  (SELECT count(*)=2 FROM pg_constraint c
   WHERE c.conname IN ('timeease_fulfillment_outbox_intake_id_fkey','timeease_delivery_ledger_intake_id_fkey')
   AND c.conrelid IN ('public.timeease_fulfillment_outbox'::regclass,'public.timeease_delivery_ledger'::regclass)
   AND c.contype='f' AND c.convalidated AND c.confrelid='public.timeease_v2_orders'::regclass
   AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='intake_id')]::smallint[]
   AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.confrelid AND attname='intake_id')]::smallint[]
  ) AND (SELECT count(*)=5 FROM pg_constraint c
   WHERE c.conrelid IN ('public.timeease_fulfillment_outbox'::regclass,'public.timeease_delivery_ledger'::regclass)
   AND c.contype IN ('p','u') AND c.convalidated AND c.conname IN (
    'timeease_fulfillment_outbox_pkey','timeease_fulfillment_outbox_shopify_order_id_key',
    'timeease_delivery_ledger_pkey','timeease_delivery_ledger_intake_id_delivery_kind_key',
    'timeease_delivery_ledger_provider_message_id_key')) AS schema_ready,
  has_table_privilege(current_user,'public.timeease_fulfillment_outbox','SELECT')
  AND has_table_privilege(current_user,'public.timeease_fulfillment_outbox','INSERT')
  AND has_table_privilege(current_user,'public.timeease_delivery_ledger','SELECT')
  AND has_table_privilege(current_user,'public.timeease_delivery_ledger','INSERT')
  AND (SELECT bool_and(has_column_privilege(current_user,'public.timeease_fulfillment_outbox',col,'UPDATE'))
   FROM unnest(ARRAY['status','attempt_count','lease_until','updated_at']) col)
  AND (SELECT bool_and(has_column_privilege(current_user,'public.timeease_delivery_ledger',col,'UPDATE'))
   FROM unnest(ARRAY['status','provider_message_id','attempt_number','updated_at']) col)
  AND NOT has_table_privilege(current_user,'public.timeease_fulfillment_outbox','DELETE')
  AND NOT has_table_privilege(current_user,'public.timeease_fulfillment_outbox','TRUNCATE')
  AND NOT has_table_privilege(current_user,'public.timeease_delivery_ledger','DELETE')
  AND NOT has_table_privilege(current_user,'public.timeease_delivery_ledger','TRUNCATE')
  AND NOT has_column_privilege(current_user,'public.timeease_fulfillment_outbox','intake_id','UPDATE')
  AND NOT has_column_privilege(current_user,'public.timeease_fulfillment_outbox','shopify_order_id','UPDATE')
  AND NOT has_column_privilege(current_user,'public.timeease_delivery_ledger','intake_id','UPDATE')
  AND NOT has_column_privilege(current_user,'public.timeease_delivery_ledger','delivery_id','UPDATE')
  AND NOT has_column_privilege(current_user,'public.timeease_delivery_ledger','delivery_kind','UPDATE')
  AS permissions_ready`);
 if(q.rows[0]?.schema_ready!==true)throw Error('OUTBOX_SCHEMA_NOT_READY');
 if(q.rows[0]?.permissions_ready!==true)throw Error('OUTBOX_ROLE_NOT_READY');
}
async function lockOrder(id:string,client:Client):Promise<Order>{
 const q=await client.query<Order>(`SELECT intake_id,shopify_order_id,status,result_path,
 delivery_message_id,last_error,source_manifest_path FROM public.timeease_v2_orders WHERE intake_id=$1 FOR UPDATE`,[id]);
 const o=q.rows[0];
 if(!o||o.source_manifest_path!==`intake-v2/${id}/manifest.json`)throw Error('OUTBOX_ORDER_BINDING_REQUIRED');
 return o;
}
async function pair(id:string,client:Client):Promise<{outbox:Outbox|undefined;ledger:Ledger|undefined}>{
 const a=await client.query<Outbox>(`SELECT intake_id,shopify_order_id,status,attempt_count,
 lease_until<=now() AS expired FROM public.timeease_fulfillment_outbox WHERE intake_id=$1 FOR UPDATE`,[id]);
 const b=await client.query<Ledger>(`SELECT delivery_id,intake_id,delivery_kind,status,provider_message_id,attempt_number
 FROM public.timeease_delivery_ledger WHERE intake_id=$1 AND delivery_kind='RESULT_EMAIL' FOR UPDATE`,[id]);
 return {outbox:a.rows[0],ledger:b.rows[0]};
}
function validatePair(o:Order,p:Awaited<ReturnType<typeof pair>>):void{
 if(!p.outbox||!p.ledger||p.outbox.shopify_order_id!==o.shopify_order_id||p.ledger.intake_id!==o.intake_id)
  throw Error('OUTBOX_LEDGER_BINDING_CONFLICT');
}
async function one(client:Client,sql:string,args:unknown[]):Promise<void>{
 if((await client.query(sql,args)).rowCount!==1)throw Error('OUTBOX_TRANSITION_CONFLICT');
}
/** Durable result + enqueue + ledger are committed together by the caller. */
export async function publishV2Result(id:string,path:string,deliveryId:string,client:Client):Promise<'ENQUEUED'|'IDEMPOTENT'|'NOT_READY'>{
 if(path!==`results-v2/${id}/consolidated.xlsx`)throw Error('INVALID_RESULT_PATH');
 const o=await lockOrder(id,client);
 if(o.status!=='PROCESSING'||o.delivery_message_id)return 'NOT_READY';
 if(o.result_path&&o.result_path!==path)throw Error('OUTBOX_RESULT_BINDING_CONFLICT');
 const p=await pair(id,client);
 if(p.outbox||p.ledger){
  validatePair(o,p);
  if(o.result_path!==path)throw Error('OUTBOX_RESULT_BINDING_CONFLICT');
  return 'IDEMPOTENT'; // Never reset status, lease, counters, delivery ID or receipt.
 }
 if(o.last_error!==null)return 'NOT_READY';
 if(!await markResultReady(id,path,client))throw Error('OUTBOX_RESULT_NOT_READY');
 await one(client,`INSERT INTO public.timeease_fulfillment_outbox
 (intake_id,shopify_order_id,status,attempt_count) VALUES ($1,$2,'PENDING',0) RETURNING intake_id`,[id,o.shopify_order_id]);
 await one(client,`INSERT INTO public.timeease_delivery_ledger
 (delivery_id,intake_id,delivery_kind,status,attempt_number)
 VALUES ($1,$2,'RESULT_EMAIL','PENDING',0) RETURNING intake_id`,[deliveryId,id]);
 return 'ENQUEUED';
}
/** One lease/attempt. Repeated or expired claims never grant another send. */
export async function claimV2Outbox(id:string,client:Client):Promise<'CLAIMED'|'IN_FLIGHT'|'NOT_CLAIMABLE'>{
 const o=await lockOrder(id,client);
 if(o.status!=='PROCESSING'||o.result_path!==`results-v2/${id}/consolidated.xlsx`||o.delivery_message_id)return 'NOT_CLAIMABLE';
 const p=await pair(id,client);validatePair(o,p);
 if(p.outbox!.status==='PROCESSING'&&p.ledger!.status==='SENDING')return 'IN_FLIGHT';
 if(p.outbox!.status!=='PENDING'||p.ledger!.status!=='PENDING'||p.outbox!.attempt_count!==0||p.ledger!.attempt_number!==0||o.last_error!==null)return 'NOT_CLAIMABLE';
 await one(client,`UPDATE public.timeease_fulfillment_outbox SET status='PROCESSING',
 attempt_count=attempt_count+1,lease_until=now()+interval '10 minutes',updated_at=now()
 WHERE intake_id=$1 AND status='PENDING' AND attempt_count=0 RETURNING intake_id`,[id]);
 await one(client,`UPDATE public.timeease_delivery_ledger SET status='SENDING',
 attempt_number=attempt_number+1,updated_at=now()
 WHERE intake_id=$1 AND delivery_kind='RESULT_EMAIL' AND status='PENDING' AND attempt_number=0 RETURNING intake_id`,[id]);
 await one(client,`UPDATE public.timeease_v2_orders SET last_error=$2
 WHERE intake_id=$1 AND status='PROCESSING' AND last_error IS NULL RETURNING intake_id`,[id,OUTBOX_RESERVED]);
 return 'CLAIMED';
}
async function quarantine(id:string,expiredOnly:boolean,client:Client):Promise<boolean>{
 const o=await lockOrder(id,client);
 if(o.status!=='PROCESSING'||o.delivery_message_id||o.last_error!==OUTBOX_RESERVED)return false;
 const p=await pair(id,client);validatePair(o,p);
 if(p.outbox!.status!=='PROCESSING'||p.ledger!.status!=='SENDING'||p.ledger!.provider_message_id)return false;
 if(expiredOnly&&p.outbox!.expired!==true)return false;
 await one(client,`UPDATE public.timeease_fulfillment_outbox SET status='FAILED',lease_until=NULL,updated_at=now()
 WHERE intake_id=$1 AND status='PROCESSING' RETURNING intake_id`,[id]);
 await one(client,`UPDATE public.timeease_delivery_ledger SET status=$2,updated_at=now()
 WHERE intake_id=$1 AND delivery_kind='RESULT_EMAIL' AND status='SENDING' AND provider_message_id IS NULL RETURNING intake_id`,[id,expiredOnly?'UNKNOWN':'FAILED']);
 await one(client,`UPDATE public.timeease_v2_orders SET status='REVIEW_REQUIRED',last_error=$2
 WHERE intake_id=$1 AND status='PROCESSING' RETURNING intake_id`,[id,expiredOnly?'OUTBOX_LEASE_EXPIRED_NO_AUTO_RESEND':'OUTBOX_FAILED_BEFORE_SEND_MANUAL_REVIEW']);
 return true;
}
export const recoverV2Outbox=(id:string,client:Client)=>quarantine(id,true,client);
/** Only use when the trusted caller knows no provider send was attempted. */
export const failV2OutboxBeforeSend=(id:string,client:Client)=>quarantine(id,false,client);

/** Trusted receipt only; not exposed by the no-email Preview acceptance endpoint. */
export async function completeV2Outbox(id:string,messageId:string,client:Client):Promise<'DELIVERED'|'IDEMPOTENT'|'REJECTED'>{
 if(!/^[a-f0-9]{10,64}$/i.test(messageId))throw Error('INVALID_DELIVERY_RECEIPT');
 const o=await lockOrder(id,client),p=await pair(id,client);validatePair(o,p);
 if(o.status==='DELIVERED'&&o.delivery_message_id===messageId&&p.outbox!.status==='DELIVERED'&&
  p.ledger!.status==='SENT'&&p.ledger!.provider_message_id===messageId)return 'IDEMPOTENT';
 if(o.status!=='PROCESSING'||o.last_error!==OUTBOX_RESERVED||o.delivery_message_id||
  p.outbox!.status!=='PROCESSING'||p.outbox!.expired!==false||p.ledger!.status!=='SENDING'||p.ledger!.provider_message_id)return 'REJECTED';
 if(!await markDelivered(id,messageId,client))throw Error('OUTBOX_RECEIPT_CONFLICT');
 await one(client,`UPDATE public.timeease_delivery_ledger SET status='SENT',provider_message_id=$2,updated_at=now()
 WHERE intake_id=$1 AND delivery_kind='RESULT_EMAIL' AND status='SENDING' AND provider_message_id IS NULL RETURNING intake_id`,[id,messageId]);
 await one(client,`UPDATE public.timeease_fulfillment_outbox SET status='DELIVERED',lease_until=NULL,updated_at=now()
 WHERE intake_id=$1 AND status='PROCESSING' RETURNING intake_id`,[id]);
 return 'DELIVERED';
}
export async function inspectV2Outbox(id:string,client:Client){
 return pair(id,client);
}
