import {strict as assert} from "node:assert";
import {test} from "node:test";
import {checkoutIsEnabled} from "../lib/checkout-readiness.ts";
const ready={
 TIMEEASE_V2_CHECKOUT_ENABLED:"true",
 TIMEEASE_V2_DELIVERY_VERIFIED:"true",
 BLOB_READ_WRITE_TOKEN:"blob",
 SHOPIFY_WEBHOOK_SECRET:"webhook",
 TIMEEASE_CHECKOUT_BINDING_SECRET:"binding",
 SHOPIFY_SHOP_DOMAIN:"bvzw62-1t.myshopify.com"
} as NodeJS.ProcessEnv;
test("checkout is closed by default",()=>assert.equal(checkoutIsEnabled({}),false));
test("checkout requires all independent gates",()=>{
 assert.equal(checkoutIsEnabled(ready),true);
 for(const key of Object.keys(ready)){
  const env={...ready};
  delete env[key];
  assert.equal(checkoutIsEnabled(env),false,key);
 }
});
test("checkout rejects invalid shop domain",()=>assert.equal(checkoutIsEnabled({...ready,SHOPIFY_SHOP_DOMAIN:"evil.example.com"}),false));
