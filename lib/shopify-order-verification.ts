// Validate Shopify paid order against a server-generated checkout binding.
// Never trust intake IDs, product variants or amounts supplied only by a webhook.
export type CheckoutBinding={
 intakeId:string;
 shopDomain:string;
 variantId:string;
 amountUsd:number;
 currency:"USD";
};
export type ShopifyPaidOrder={
 id:unknown;
 financial_status?:unknown;
 currency?:unknown;
 total_price?:unknown;
 line_items?:unknown;
};
export function verifyPaidOrder(order:ShopifyPaidOrder,binding:CheckoutBinding):boolean{
 if(!order||typeof order!=="object"||order.financial_status!=="paid"||order.currency!=="USD")return false;
 if(typeof order.id!=="number"&&typeof order.id!=="string")return false;
 if(!Number.isSafeInteger(binding.amountUsd)||binding.amountUsd<1||!/^[0-9]+$/.test(binding.variantId))return false;
 if(typeof order.total_price!=="string"||!/^[0-9]+(?:\\.[0-9]{1,2})?$/.test(order.total_price))return false;
 const cents=Math.round(Number(order.total_price)*100);
 if(!Number.isSafeInteger(cents)||cents!==binding.amountUsd*100)return false;
 if(!Array.isArray(order.line_items)||order.line_items.length!==1)return false;
 const line=order.line_items[0] as Record<string,unknown>;
 return !!line&&String(line.variant_id)===binding.variantId&&line.quantity===1;
}
