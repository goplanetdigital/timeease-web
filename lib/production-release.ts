// Draft-only release gates. Existing Production flags cannot opt this code in.
// A rollback may freeze new work/sends while still accepting receipts/recovery.
export const PRODUCTION_PROJECT='prj_2w1jB9WzF64hLNb6jRDxQw3LGSKR';
export const PRODUCTION_NEON_PROJECT='odd-base-63790740';
export const PRODUCTION_NEON_BRANCH='br-wispy-river-aoo9eown';
export function productionReleaseBound(env:NodeJS.ProcessEnv=process.env):boolean{
 const sha=env.TIMEEASE_RELEASE_COMMIT_SHA;
 return env.VERCEL_ENV==='production'&&env.VERCEL_PROJECT_ID===PRODUCTION_PROJECT&&
  env.TIMEEASE_ISOLATED_TEST_MODE!=='true'&&env.TIMEEASE_V2_OUTBOX_ENABLED==='true'&&
  typeof sha==='string'&&/^[a-f0-9]{40}$/.test(sha)&&sha===env.VERCEL_GIT_COMMIT_SHA;
}
export function acceptingProductionWork(env:NodeJS.ProcessEnv=process.env):boolean{
 return productionReleaseBound(env)&&env.TIMEEASE_RELEASE_ACCEPTING_WORK==='true'&&
  env.TIMEEASE_V2_PAYMENT_LEDGER_ENABLED==='true';
}
export function productionSendEnabled(env:NodeJS.ProcessEnv=process.env):boolean{
 return acceptingProductionWork(env)&&env.TIMEEASE_RELEASE_SEND_ENABLED==='true';
}

// Shopify single-task release only. Stripe subscriptions/credits need their own
// authenticated, atomic event/credit ledger release before any billing mutation.
export function stripeBillingReleased():boolean{return false;}
