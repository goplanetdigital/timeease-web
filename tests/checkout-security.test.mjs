// Run with: node --test tests/checkout-security.test.mjs (Node 24+)
// These tests use only synthetic values and never call Shopify or charge a card.
import test from 'node:test';
import assert from 'node:assert/strict';
import {signCheckoutToken,verifyCheckoutToken} from '../lib/checkout-binding.ts';
import {verifyPaidOrder} from '../lib/shopify-order-verification.ts';
import {verifyBoundShopifyOrder} from '../lib/shopify-bound-order.ts';

const secret='timeease-test-secret-not-for-production-123456789';
const now=1_800_000_000;
const payload={intakeId:'123e4567-e89b-42d3-a456-426614174000',variantId:'51393328480503',amountUsd:1,expiresAt:now+600};
const order={id:12345,financial_status:'paid',currency:'USD',total_price:'1.00',line_items:[{variant_id:51393328480503,quantity:1}]};
const bound=(attributes)=>({...order,note_attributes:attributes});
const attr=(value)=>({name:'_timeease_checkout_binding',value});

test('signed paid order accepts matching intake, variant and amount',()=>{
 const token=signCheckoutToken(payload,secret);
 assert.deepEqual(verifyBoundShopifyOrder(bound([attr(token)]),secret,now),payload);
});
test('rejects missing, duplicate and tampered bindings',()=>{
 const token=signCheckoutToken(payload,secret);
 assert.equal(verifyBoundShopifyOrder(bound([]),secret,now),null);
 assert.equal(verifyBoundShopifyOrder(bound([attr(token),attr(token)]),secret,now),null);
 assert.equal(verifyBoundShopifyOrder(bound([attr(token.slice(0,-1)+'X')]),secret,now),null);
});
test('rejects expired binding',()=>{
 const token=signCheckoutToken({...payload,expiresAt:now-7*24*3600-1},secret);
 assert.equal(verifyBoundShopifyOrder(bound([attr(token)]),secret,now),null);
});
test('rejects unpaid, wrong amount, wrong currency, extra items and wrong variant',()=>{
 const binding={intakeId:payload.intakeId,variantId:payload.variantId,amountUsd:1,currency:'USD'};
 assert.equal(verifyPaidOrder(order,binding),true);
 for(const altered of [
  {...order,financial_status:'pending'},
  {...order,total_price:'9.00'},
  {...order,currency:'MYR'},
  {...order,line_items:[...order.line_items,...order.line_items]},
  {...order,line_items:[{variant_id:999,quantity:1}]},
  {...order,line_items:[{variant_id:51393328480503,quantity:2}]},
 ])assert.equal(verifyPaidOrder(altered,binding),false);
});
