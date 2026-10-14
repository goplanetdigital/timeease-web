import {signCheckoutToken,type CheckoutTokenPayload} from "./checkout-binding.ts";

const SHOP="bvzw62-1t.myshopify.com";
const DOMAIN=/^[a-z0-9][a-z0-9-]*[.]myshopify[.]com$/;

/**
 * Shopify cart permalink with an order-level cart attribute.
 * The attribute must survive checkout as order.note_attributes for
 * authenticated webhook matching. Do not expose this URL to customers
 * until a real Shopify test order confirms that persistence.
 */
export function buildBoundCartPermalink(
 payload:CheckoutTokenPayload,
 secret:string,
 shop=SHOP
):string{
 if(!DOMAIN.test(shop))throw new Error("INVALID_SHOP_DOMAIN");
 const binding=signCheckoutToken(payload,secret);
 const url=new URL("https://"+shop+"/cart/"+payload.variantId+":1");
 url.searchParams.set("attributes[_timeease_checkout_binding]",binding);
 return url.toString();
}
