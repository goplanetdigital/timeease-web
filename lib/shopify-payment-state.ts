type State={kind:'PAID';orderId:string}|{kind:'HOLD';orderId:string;reason:'CANCELLED'|'REFUNDED'}|{kind:'REJECT'};
function id(value:unknown):string|null{
 if(typeof value==='number'&&!Number.isSafeInteger(value))return null;
 return (typeof value==='string'||typeof value==='number')&&/^[1-9][0-9]*$/.test(String(value))?String(value):null;
}
/** Classify authenticated Shopify payloads only. Stripe PI events are never a second order authority. */
export function shopifyPaymentState(topic:string|null,body:Record<string,unknown>):State{
 if(body.test===true)return {kind:'REJECT'};
 const orderId=id(topic==='refunds/create'?body.order_id:body.id);if(!orderId)return {kind:'REJECT'};
 if(topic==='orders/cancelled')return {kind:'HOLD',orderId,reason:'CANCELLED'};
 if(topic==='refunds/create')return {kind:'HOLD',orderId,reason:'REFUNDED'};
 if(topic!=='orders/paid'||body.test!==false||body.financial_status!=='paid')return {kind:'REJECT'};
 if(body.cancelled_at)return {kind:'HOLD',orderId,reason:'CANCELLED'};
 if(Array.isArray(body.refunds)&&body.refunds.length)return {kind:'HOLD',orderId,reason:'REFUNDED'};
 return {kind:'PAID',orderId};
}
