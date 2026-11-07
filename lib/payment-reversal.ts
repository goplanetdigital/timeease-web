import {lockPayment,type TransactionClient} from './production-database';
// A monotonic hold survives a refund/cancel arriving before the paid webhook.
// Never rewrite terminal orders, receipts, counters, bindings or result paths.
export async function holdShopifyPayment(orderId:string,shop:string,reason:'CANCELLED'|'REFUNDED',client:TransactionClient):Promise<string>{
 if(!/^[1-9][0-9]*$/.test(orderId))throw Error('INVALID_ORDER_ID');
 await lockPayment(shop,orderId,client);
 await client.query(`INSERT INTO public.timeease_payment_holds(shop_domain,shopify_order_id,reason)
 VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[shop,orderId,reason]);
 const o=(await client.query(`SELECT intake_id,status,delivery_message_id FROM public.timeease_v2_orders
 WHERE shopify_shop_domain=$1 AND shopify_order_id=$2 FOR UPDATE`,[shop,orderId])).rows[0];
 if(!o)return 'UNMATCHED_HELD';
 return quarantineOrderDelivery(o.intake_id,'PAYMENT_'+reason+'_NO_AUTO_RESEND',client);
}
export async function quarantineOrderDelivery(id:string,reason:string,client:TransactionClient):Promise<string>{
 const o=(await client.query('SELECT intake_id,status,delivery_message_id FROM public.timeease_v2_orders WHERE intake_id=$1 FOR UPDATE',[id])).rows[0];
 if(!o||!['PAID','PROCESSING'].includes(o.status)||o.delivery_message_id)return 'TERMINAL_RETAINED';
 const box=(await client.query('SELECT status FROM public.timeease_fulfillment_outbox WHERE intake_id=$1 FOR UPDATE',[o.intake_id])).rows[0];
 if(box){
  await client.query(`UPDATE public.timeease_fulfillment_outbox SET status='FAILED',lease_until=NULL,updated_at=now()
   WHERE intake_id=$1 AND status IN ('PENDING','PROCESSING')`,[o.intake_id]);
  await client.query(`UPDATE public.timeease_delivery_ledger SET status=CASE WHEN status='SENDING' THEN 'UNKNOWN' ELSE 'FAILED' END,updated_at=now()
   WHERE intake_id=$1 AND status IN ('PENDING','SENDING') AND provider_message_id IS NULL`,[o.intake_id]);
 }
 await client.query(`UPDATE public.timeease_v2_orders SET status='REVIEW_REQUIRED',last_error=$2
 WHERE intake_id=$1 AND status IN ('PAID','PROCESSING') AND delivery_message_id IS NULL`,[o.intake_id,reason]);
 return 'HELD';
}
