/**
 * Single fail-closed source of truth for checkout readiness.
 * The operator must explicitly enable checkout AND attest delivery testing.
 * Never infer readiness merely because Shopify credentials are present.
 */
export function checkoutIsEnabled(env:NodeJS.ProcessEnv=process.env):boolean{
 return env.TIMEEASE_V2_CHECKOUT_ENABLED==="true" &&
 env.TIMEEASE_V2_DELIVERY_VERIFIED==="true" &&
 Boolean(env.BLOB_READ_WRITE_TOKEN) &&
 Boolean(env.SHOPIFY_WEBHOOK_SECRET) &&
 Boolean(env.TIMEEASE_CHECKOUT_BINDING_SECRET) &&
 /^[a-z0-9][a-z0-9-]*[.]myshopify[.]com$/.test(env.SHOPIFY_SHOP_DOMAIN||"");
}
