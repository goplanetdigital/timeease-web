import {strict as assert} from "node:assert";
import {test} from "node:test";
import {signCheckoutToken,verifyCheckoutToken} from "../lib/checkout-binding.ts";
const secret="a".repeat(48);
const now=1900000000;
const payload={intakeId:"123e4567-e89b-42d3-a456-426614174000",variantId:"51293065117943",amountUsd:9,expiresAt:now+600};
test("signed checkout token round trips",()=>{
 const token=signCheckoutToken(payload,secret);
 assert.deepEqual(verifyCheckoutToken(token,secret,now),payload);
});
test("tampering, expiry, wrong secret and malformed input fail closed",()=>{
 const token=signCheckoutToken(payload,secret);
 assert.equal(verifyCheckoutToken(token,"b".repeat(48),now),null);
 assert.equal(verifyCheckoutToken(token,secret,now+600),null);
 assert.equal(verifyCheckoutToken(token+"x",secret,now),null);
 assert.equal(verifyCheckoutToken("invalid",secret,now),null);
 assert.throws(()=>signCheckoutToken({...payload,variantId:"not-a-number"},secret));
});
