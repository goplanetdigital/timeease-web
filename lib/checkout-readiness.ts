import { calculateQuote, type QuoteInput } from "./upload-first-pricing";

/**
 * Server-side checkout guard. Never accept an amount or variant ID supplied
 * by the browser. Resolve both from the persisted intake manifest instead.
 * This is a prerequisite for checkout, NOT payment verification.
 */
// Verified against Shopify product variants on 2026-10-14.
const variants = {
  invoice: { basic: "51269543428343", complex: "51291397423351", batch: "51291397456119" },
  catalogue: { "100 rows": "51293145759991", "500 rows": "51293145792759", "2000 rows": "51293145825527" },
  resume: { resume: "51293146087671", full: "51293146120439" },
} as const;

export type CheckoutSelection = {
  variantId: string;
  amountUsd: number;
  service: QuoteInput["service"];
  fileCount: number;
};

export function resolveCheckoutSelection(input: QuoteInput): CheckoutSelection {
  const quote = calculateQuote(input);
  let variantId: string | undefined;
  if (quote.service === "invoice") {
    variantId = variants.invoice[quote.variantLabel as keyof typeof variants.invoice];
  } else if (quote.service === "catalogue") {
    variantId = variants.catalogue[quote.variantLabel as keyof typeof variants.catalogue];
  } else if (quote.service === "resume") {
    variantId = variants.resume[quote.variantLabel as keyof typeof variants.resume];
  } else {
    // Consolidation has one Shopify variant per supported invoice count:
    // 1-10 => base tier; 11-100 => quantity-specific tier.
    // IDs must be resolved against Shopify, not guessed from adjacent IDs.
    throw new Error("CONSOLIDATION_VARIANT_LOOKUP_REQUIRED");
  }
  if (!variantId) throw new Error("NO_MATCHING_SHOPIFY_VARIANT");
  // Shopify SKU and price must be rechecked before activating live checkout.
  // These IDs are not evidence of a paid order.
  return { variantId, amountUsd: quote.amountUsd, service: quote.service, fileCount: input.fileCount };
}

/** Recompute the quote from trusted manifest fields before creating checkout. */
export function verifyStoredIntake(manifest: unknown): CheckoutSelection {
  if (!manifest || typeof manifest !== "object") throw new Error("INVALID_INTAKE_MANIFEST");
  const m = manifest as Record<string, unknown>;
  if (m.status !== "AWAITING_PAYMENT" || m.checkoutOrderId !== null) {
    throw new Error("INTAKE_NOT_AVAILABLE_FOR_CHECKOUT");
  }
  if (!Array.isArray(m.files) || m.files.length < 1 || m.files.length > 100) {
    throw new Error("INVALID_STORED_FILES");
  }
  if (!m.quote || typeof m.quote !== "object") throw new Error("MISSING_STORED_QUOTE");
  const quote = m.quote as Record<string, unknown>;
  const service = m.service;
  if (!["invoice", "consolidation", "catalogue", "resume"].includes(String(service))) {
    throw new Error("INVALID_STORED_SERVICE");
  }
  if (!m.quoteInput || typeof m.quoteInput !== "object") throw new Error("MISSING_QUOTE_INPUT");
  const saved = m.quoteInput as Record<string, unknown>;
  if (saved.service !== service || saved.fileCount !== m.files.length) {
    throw new Error("QUOTE_INPUT_MISMATCH");
  }
  const input: QuoteInput = {
    service: service as QuoteInput["service"],
    fileCount: m.files.length,
    tier: saved.tier as QuoteInput["tier"],
    catalogueRows: saved.catalogueRows as number | undefined,
  };
  const recomputed = calculateQuote(input);
  if (recomputed.amountUsd !== quote.amountUsd ||
      recomputed.variantLabel !== quote.variantLabel ||
      quote.currency !== "USD") {
    throw new Error("STORED_QUOTE_MISMATCH");
  }
  return resolveCheckoutSelection(input);
}
