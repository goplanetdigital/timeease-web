// Pure sender-boundary functions. No I/O, credentials, global job lookup or sender.
export function authorizeOneDelivery(items,now=Date.now()){
 if(!Array.isArray(items)||items.length!==1)throw Error('EXACTLY_ONE_DELIVERY_REQUIRED');
 const item=items[0],expected=item?.expected,response=item?.response;
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!expected||!uuid.test(expected.intakeId)||expected.attachmentIntakeId!==expected.intakeId||
  expected.resultPath!==`results-v2/${expected.intakeId}/consolidated.xlsx`||
  typeof expected.customerEmail!=='string'||expected.customerEmail.length>254||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(expected.customerEmail))throw Error('ORDER_ATTACHMENT_BINDING_REQUIRED');
 let b=response?.body;
 if(typeof b==='string'){try{b=JSON.parse(b);}catch{throw Error('JSON_RESPONSE_REQUIRED');}}
 if(response?.statusCode!==200||!b||b.ok!==true||b.send!==true||b.outbox!=='CLAIMED'||
  b.intakeId!==expected.intakeId||typeof b.deliveryId!=='string'||!uuid.test(b.deliveryId))throw Error('DURABLE_CLAIM_REQUIRED');
 const deadline=typeof b.leaseUntil==='string'?Date.parse(b.leaseUntil):NaN;
 if(!Number.isFinite(now)||!Number.isFinite(deadline)||deadline-now<=30000||deadline-now>600000)throw Error('LIVE_LEASE_REQUIRED');
 return {intakeId:expected.intakeId,deliveryId:b.deliveryId,resultPath:expected.resultPath,
  customerEmail:expected.customerEmail,leaseUntil:b.leaseUntil};
}
export function boundReceiptReport(context,receipt){
 if(!context||typeof context.intakeId!=='string'||typeof context.deliveryId!=='string'||
  typeof receipt?.id!=='string'||!/^[a-f0-9]{10,64}$/i.test(receipt.id))throw Error('BOUND_GMAIL_RECEIPT_REQUIRED');
 return {intakeId:context.intakeId,action:'delivered',deliveryId:context.deliveryId,messageId:receipt.id};
}
export function exceptionCounts(response){
 if(response?.statusCode!==200||response.body?.ledgerReachable!==true)throw Error('MONITOR_UNAVAILABLE');
 const b=response.body;
 const count=(rows,status)=>{
  if(!Array.isArray(rows))throw Error('MONITOR_SHAPE_REQUIRED');
  const row=rows.find(r=>r.status===status);const n=row?.count??0;
  if(!Number.isInteger(n)||n<0)throw Error('MONITOR_COUNT_REQUIRED');return n;
 };
 const expired=b.expiredLeases;
 if(!Number.isInteger(expired)||expired<0)throw Error('MONITOR_COUNT_REQUIRED');
 return {expiredLeases:expired,unknown:count(b.deliveryLedger,'UNKNOWN'),failed:count(b.outbox,'FAILED')};
}
