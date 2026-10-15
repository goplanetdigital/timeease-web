import {strict as assert} from "node:assert";
import {test} from "node:test";
import {signCheckoutToken} from "../lib/checkout-binding.ts";
import {verifyBoundShopifyOrder} from "../lib/shopify-bound-order.ts";
const secret="s".repeat(48);
const now=1900000000;
const payload={intakeId:"123e4567-e89b-42d3-a456-426614174000",variantId:"51293065117943",amountUsd:9,expiresAt:now+600};
const token=signCheckoutToken(payload,secret);
const order={id:1001,financial_status:"paid",currency:"USD",total_price:"9.00",line_items:[{variant_id:51293065117943,quantity:1}],note_attributes:[{name:"_timeease_checkout_binding",value:token}]};
test("accept valid signed intake reference on paid Shopify order",()=>assert.deepEqual(verifyBoundShopifyOrder(order,secret,now),payload));
test("reject missing, duplicate, expired, tampered, unpaid or mismatched orders",()=>{
 for(const changed of [
  {note_attributes:[]},
  {note_attributes:[...order.note_attributes,...order.note_attributes]},
  {note_attributes:[{name:"_timeease_checkout_binding",value:token+"x"}]},
  {financial_status:"pending"},
  {currency:"MYR"},
  {total_price:"19.00"},
  {line_items:[{variant_id:1,quantity:1}]},
  {line_items:[{variant_id:51293065117943,quantity:2}]}
 ])assert.equal(verifyBoundShopifyOrder({...order,...changed},secret,now),null);
 assert.deepEqual(verifyBoundShopifyOrder(order,secret,now+600),payload);
 assert.deepEqual(verifyBoundShopifyOrder(order,secret,now+3600),payload);
 assert.equal(verifyBoundShopifyOrder(order,secret,now+600+7*24*3600),null);
});
