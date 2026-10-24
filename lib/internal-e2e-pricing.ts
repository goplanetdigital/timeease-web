/** Isolated USD 1 internal E2E acceptance constants. Never use for public quotes. */
export const INTERNAL_E2E_USD1 = Object.freeze({
  variantId: "51393328480503",
  sku: "TIMEEASE-E2E-USD1",
  amountUsd: 1,
  currency: "USD" as const,
});

/**
 * Only an authenticated server-side test flow may invoke this assertion.
 * Never derive the amount or variant from user input or an existing USD 9 intake.
 */
export function assertInternalE2EPrice(
  authenticated: boolean,
  variantId: string,
  amountUsd: number,
): void {
  if (!authenticated) throw new Error("INTERNAL_TEST_AUTH_REQUIRED");
  if (variantId !== INTERNAL_E2E_USD1.variantId || amountUsd !== INTERNAL_E2E_USD1.amountUsd) {
    throw new Error("INTERNAL_TEST_PRICE_MISMATCH");
  }
}
