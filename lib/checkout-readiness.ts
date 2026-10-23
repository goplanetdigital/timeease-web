/**
 * Single fail-closed source of truth for checkout readiness.
 * The operator must explicitly enable checkout AND attest delivery testing.
 * Never infer readiness merely because Shopify credentials are present.
 */
/**
 * Private test readiness is not a customer-facing checkout gate.
 * It may only be used by authenticated, isolated validation tooling.
 * Never set DELIVERY_VERIFIED from this check.
 */
export function checkoutTestPrerequisitesReady(env:NodeJS.ProcessEnv=process.env):boolean{
 return env.TIMEEASE_V2_PAYMENT_LEDGER_ENABLED==="true" &&
 Boolean(env.TIMEEASE_DB_DATABASE_URL) &&
 Boolean(env.BLOB_READ_WRITE_TOKEN) &&
 Boolean(env.SHOPIFY_WEBHOOK_SECRET) &&
 Boolean(env.TIMEEASE_CHECKOUT_BINDING_SECRET) &&
 /^[a-z0-9][a-z0-9-]*[.]myshopify[.]com$/.test(env.SHOPIFY_SHOP_DOMAIN||"");
}

export function checkoutIsEnabled(env:NodeJS.ProcessEnv=process.env):boolean{
 return env.TIMEEASE_V2_CHECKOUT_ENABLED==="true" &&
 env.TIMEEASE_V2_DELIVERY_VERIFIED==="true" &&
 env.TIMEEASE_V2_PAYMENT_LEDGER_ENABLED==="true" &&
 Boolean(env.TIMEEASE_DB_DATABASE_URL) &&
 Boolean(env.BLOB_READ_WRITE_TOKEN) &&
 Boolean(env.SHOPIFY_WEBHOOK_SECRET) &&
 Boolean(env.TIMEEASE_CHECKOUT_BINDING_SECRET) &&
 /^[a-z0-9][a-z0-9-]*[.]myshopify[.]com$/.test(env.SHOPIFY_SHOP_DOMAIN||"");
}
