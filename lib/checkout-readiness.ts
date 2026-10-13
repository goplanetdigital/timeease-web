import { calculateQuote, type QuoteInput } from "./upload-first-pricing";

/**
 * Server-side checkout guard. Never accept an amount or variant ID supplied
 * by the browser. Resolve both from the persisted intake manifest instead.
 * This is a prerequisite for checkout, NOT payment verification.
 */
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
  return { variantId, amountUsd: quote.amountUsd, service: quote.service, fileCount: input.fileCount };
}
