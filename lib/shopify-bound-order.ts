import {verifyCheckoutToken,type CheckoutTokenPayload} from "./checkout-binding.ts";
import {verifyPaidOrder,type ShopifyPaidOrder} from "./shopify-order-verification.ts";

type Attribute={name?:unknown;value?:unknown};
export type BoundShopifyOrder=ShopifyPaidOrder & {note_attributes?:unknown};
export function verifyBoundShopifyOrder(
 order:BoundShopifyOrder,
 secret:string,
 now=Math.floor(Date.now()/1000)
):CheckoutTokenPayload|null{
 if(!order||!Array.isArray(order.note_attributes))return null;
 const attrs=order.note_attributes as Attribute[];
 const matches=attrs.filter(a=>a&&a.name==="_timeease_checkout_binding"&&typeof a.value==="string");
 // Reject missing or ambiguous order bindings; never fall back to customer-supplied intake IDs.
 if(matches.length!==1)return null;
 const token=verifyCheckoutToken(matches[0].value as string,secret,now);
 if(!token)return null;
 const ok=verifyPaidOrder(order,{intakeId:token.intakeId,variantId:token.variantId,amountUsd:token.amountUsd,currency:"USD"});
 return ok?token:null;
}
