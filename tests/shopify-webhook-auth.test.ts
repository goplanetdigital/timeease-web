import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { verifyShopifyWebhookHmac } from "../lib/shopify-webhook-auth";

const secret = "local-test-only-shopify-secret";
const body = Buffer.from('{"id":123,"financial_status":"paid"}');
const signature = createHmac("sha256", secret).update(body).digest("base64");

test("Shopify webhook requires exact raw-body HMAC", () => {
  assert.equal(verifyShopifyWebhookHmac(body, signature, secret), true);
  assert.equal(verifyShopifyWebhookHmac(body, signature, undefined), false);
  assert.equal(verifyShopifyWebhookHmac(body, undefined, secret), false);
  assert.equal(verifyShopifyWebhookHmac(Buffer.from('{"id":124,"financial_status":"paid"}'), signature, secret), false);
  assert.equal(verifyShopifyWebhookHmac(body, signature.slice(0, -1) + "A", secret), false);
  assert.equal(verifyShopifyWebhookHmac(body, "not-base64", secret), false);
  assert.equal(verifyShopifyWebhookHmac(body, " " + signature + " ", secret), true);
});
