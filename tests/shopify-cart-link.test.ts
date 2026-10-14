import {strict as assert} from "node:assert";
import {test} from "node:test";
import {buildBoundCartPermalink} from "../lib/shopify-cart-link.ts";
import {verifyCheckoutToken} from "../lib/checkout-binding.ts";
const secret="z".repeat(48);
const payload={intakeId:"123e4567-e89b-42d3-a456-426614174000",variantId:"51293065117943",amountUsd:9,expiresAt:1900000600};
test("Shopify cart link preserves signed upload binding",()=>{
 const url=new URL(buildBoundCartPermalink(payload,secret));
 assert.equal(url.hostname,"bvzw62-1t.myshopify.com");
 assert.equal(url.pathname,"/cart/51293065117943:1");
 const token=url.searchParams.get("attributes[_timeease_checkout_binding]");
 assert.ok(token);
 assert.deepEqual(verifyCheckoutToken(token,secret,1900000000),payload);
});
test("reject untrusted shop domain",()=>assert.throws(()=>buildBoundCartPermalink(payload,secret,"example.com")));
