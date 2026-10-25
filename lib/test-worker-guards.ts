export function isIsolatedPreview(env: Record<string,string|undefined>): boolean {
 return env.VERCEL_ENV === 'preview' && env.TIMEEASE_ISOLATED_TEST_MODE === 'true' && env.TIMEEASE_V2_CHECKOUT_ENABLED === 'false' && env.TIMEEASE_V2_PAYMENT_LEDGER_ENABLED === 'false';
}
export function isAllowedTestRecipient(email:string, allowed:string|undefined): boolean {
 return Boolean(allowed && email.trim().toLowerCase() === allowed.trim().toLowerCase());
}
