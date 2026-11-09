export const PREVIEW_NEON_PROJECT = 'odd-base-63790740';
export const PREVIEW_NEON_BRANCH = 'br-restless-hill-ao5vpgb4';
const RETIRED_PREVIEW_NEON_HOST = 'ep-summer-salad-aoeax66z.c-2.ap-southeast-1.aws.neon.tech';
export function isIsolatedPreview(env: Record<string,string|undefined>): boolean {
 return env.VERCEL_ENV === 'preview' && env.TIMEEASE_ISOLATED_TEST_MODE === 'true' && env.TIMEEASE_V2_CHECKOUT_ENABLED === 'false' && env.TIMEEASE_V2_PAYMENT_LEDGER_ENABLED === 'false';
}
/** Preview may use the schema-only branch endpoint, never the retired shared endpoint. */
export function isIsolatedNeonEndpoint(hostname: string): boolean {
 return /^ep-[a-z0-9-]+\.c-2\.ap-southeast-1\.aws\.neon\.tech$/.test(hostname) && hostname !== RETIRED_PREVIEW_NEON_HOST;
}
export function isAllowedTestRecipient(email:string, allowed:string|undefined): boolean {
 return Boolean(allowed && email.trim().toLowerCase() === allowed.trim().toLowerCase());
}
