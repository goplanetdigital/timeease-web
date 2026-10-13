import { calculateQuote, type QuoteInput } from "./upload-first-pricing";

/**
 * Centralized, fail-closed verification for the upcoming Shopify payment
 * integration. This does not grant access to files or mark an order paid.
 * Always verify payment server-side using Shopify's authenticated webhook.
 */
export type CheckoutManifest = {
  id: string;
  service: QuoteInput["service"];
  quote: { amountUsd: number; currency: string; variantLabel: string };
  files: Array<{ pathname: string }>;
  status: string;
  checkoutOrderId: string | null;
};

export type PaidOrderEvidence = {
  orderId: string;
  currency: string;
  paid: boolean;
  amountUsd: number;
  variantId: string;
};

const KNOWN_VARIANTS: Record<string, string> = {
  "invoice:basic": "51269543428343",
  "invoice:complex": "51291397423351",
  "invoice:batch": "51291397456119",
  "consolidation:1–10 invoices": "51293065117943",
  "catalogue:100 rows": "51293145759991",
  "catalogue:500 rows": "51293145792759",
  "catalogue:2000 rows": "51293145825527",
  "resume:resume": "51293146087671",
  "resume:full": "51293146120439",
};

export function expectedShopifyVariant(manifest: CheckoutManifest): string | null {
  const key = manifest.service + ":" + (
    manifest.service === "consolidation" && manifest.files.length <= 10
      ? "1–10 invoices"
      : manifest.quote.variantLabel
  );
  return KNOWN_VARIANTS[key] ?? null;
}

export function verifyPaidOrder(
  manifest: CheckoutManifest,
  evidence: PaidOrderEvidence,
  input: Omit<QuoteInput, "fileCount" | "service"> = {},
): { ok: boolean; reason: string } {
  if (manifest.status !== "AWAITING_PAYMENT" || manifest.checkoutOrderId !== null)
    return { ok: false, reason: "ALREADY_PROCESSED_OR_INVALID_STATE" };
  if (!evidence.paid || !evidence.orderId)
    return { ok: false, reason: "PAYMENT_NOT_VERIFIED" };
  if (!manifest.files.length)
    return { ok: false, reason: "MISSING_FILES" };
  const expectedVariant = expectedShopifyVariant(manifest);
  if (!expectedVariant || evidence.variantId !== expectedVariant)
    return { ok: false, reason: "UNKNOWN_OR_MISMATCHED_VARIANT" };
  try {
    const quote = calculateQuote({ ...input, service: manifest.service, fileCount: manifest.files.length,
      tier: manifest.service === "invoice" ? manifest.quote.variantLabel as QuoteInput["tier"] :
        manifest.service === "resume" ? manifest.quote.variantLabel as QuoteInput["tier"] : undefined,
      catalogueRows: manifest.service === "catalogue" ?
        Number(manifest.quote.variantLabel.split(" ")[0]) : undefined,
    });
    if (quote.amountUsd !== manifest.quote.amountUsd || quote.variantLabel !== manifest.quote.variantLabel)
      return { ok: false, reason: "MANIFEST_PRICE_MISMATCH" };
    if (evidence.currency !== "USD" || !Number.isFinite(evidence.amountUsd) ||
        Math.abs(evidence.amountUsd - quote.amountUsd) > 0.001)
      return { ok: false, reason: "PAID_AMOUNT_MISMATCH" };
  } catch {
    return { ok: false, reason: "INVALID_QUOTE" };
  }
  return { ok: true, reason: "VERIFIED" };
}
