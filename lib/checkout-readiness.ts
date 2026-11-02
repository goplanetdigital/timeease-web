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

/** Names only. External webhook and worker proof stay blocked until independently verified. */
export function productionLaunchBlockers(env:NodeJS.ProcessEnv,schemaReady:boolean):string[]{
 const blockers:string[]=[];
 if(env.VERCEL_ENV==="preview"||env.TIMEEASE_ISOLATED_TEST_MODE==="true")blockers.push("PREVIEW_ISOLATION");
 if(env.TIMEEASE_V2_CHECKOUT_ENABLED!=="true")blockers.push("TIMEEASE_V2_CHECKOUT_ENABLED");
 if(env.TIMEEASE_V2_DELIVERY_VERIFIED!=="true")blockers.push("TIMEEASE_V2_DELIVERY_VERIFIED");
 if(env.TIMEEASE_V2_PAYMENT_LEDGER_ENABLED!=="true")blockers.push("TIMEEASE_V2_PAYMENT_LEDGER_ENABLED");
 if(!env.TIMEEASE_DB_DATABASE_URL)blockers.push("TIMEEASE_DB_DATABASE_URL");
 if(!env.BLOB_READ_WRITE_TOKEN)blockers.push("BLOB_READ_WRITE_TOKEN");
 if(!env.SHOPIFY_WEBHOOK_SECRET)blockers.push("SHOPIFY_WEBHOOK_SECRET");
 if(!env.TIMEEASE_CHECKOUT_BINDING_SECRET)blockers.push("TIMEEASE_CHECKOUT_BINDING_SECRET");
 if(!/^[a-z0-9][a-z0-9-]*[.]myshopify[.]com$/.test(env.SHOPIFY_SHOP_DOMAIN||""))blockers.push("SHOPIFY_SHOP_DOMAIN");
 if(!env.TIMEEASE_V2_WORKER_SECRET||env.TIMEEASE_V2_WORKER_SECRET.length<32)blockers.push("TIMEEASE_V2_WORKER_SECRET");
 if(!schemaReady)blockers.push("PAYMENT_LEDGER_SCHEMA");
 blockers.push("SHOPIFY_PAID_WEBHOOK_UNVERIFIED","PRODUCTION_WORKER_EXACTLY_ONCE_UNVERIFIED");
 return blockers;
}
