import {strict as assert} from "node:assert";
import {test} from "node:test";
import {verifyPaidOrder,type CheckoutBinding} from "../lib/shopify-order-verification.ts";
const binding:CheckoutBinding={intakeId:"intake-123",variantId:"51293065117943",amountUsd:9,currency:"USD"};
const order={id:123,financial_status:"paid",currency:"USD",total_price:"9.00",line_items:[{variant_id:51293065117943,quantity:1}]};
test("matching Shopify paid order is accepted",()=>assert.equal(verifyPaidOrder(order,binding),true));
test("reject unpaid, wrong amount, wrong currency, wrong variant, or wrong quantity",()=>{
 for(const changed of [
  {financial_status:"pending"},
  {total_price:"90.00"},
  {total_price:"9x00"},
  {total_price:"9.01"},
  {total_price:"8.99"},
  {id:"not-an-order"},
  {id:0},
  {currency:"MYR"},
  {line_items:[{variant_id:1,quantity:1}]},
  {line_items:[{variant_id:51293065117943,quantity:2}]},
  {line_items:[]}
 ])assert.equal(verifyPaidOrder({...order,...changed},binding),false);
});
