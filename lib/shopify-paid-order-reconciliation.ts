import type { CheckoutSelection } from "./checkout-readiness";

/**
 * Pure reconciliation guard. The caller MUST fetch this order from Shopify
 * with trusted server credentials (or verify the webhook HMAC) first.
 * Browser-submitted order JSON is never proof of payment.
 *
 * Keep the intake reference separate from legacy "timeease_token", which
 * existing n8n flows use for post-payment upload links.
 */
export type ShopifyPaidOrder = {
  id: string | number;
  financial_status: string;
  currency: string;
  total_price: string | number;
  line_items: Array<{
    id: string | number;
    variant_id: string | number;
    sku: string;
    quantity: number;
    price: string | number;
  }>;
  note_attributes?: Array<{ name: string; value: string }>;
};

const variantSkus: Record<string, string> = {
  "51269543428343": "TIMEEASE-BASIC",
  "51291397423351": "TIMEEASE-COMPLEX",
  "51291397456119": "TIMEEASE-BATCH",
  "51293145759991": "TIMEEASE-CATALOGUE-100",
  "51293145792759": "TIMEEASE-CATALOGUE-500",
  "51293145825527": "TIMEEASE-CATALOGUE-2000",
  "51293146087671": "TIMEEASE-RESUME-BASIC",
  "51293146120439": "TIMEEASE-RESUME-FULL",
};

function toCents(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") throw new Error("INVALID_MONEY");
  const str = String(value);
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(str)) throw new Error("INVALID_MONEY");
  const [whole, fraction = ""] = str.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("INVALID_MONEY");
  return cents;
}

export type PaidOrderMatch = {
  orderId: string;
  lineItemId: string;
  intakeId: string;
  variantId: string;
};

/**
 * Validates a single-service, single-quantity paid order.
 * Caller must also enforce one-time consumption atomically in persistent
 * storage before releasing private files or starting fulfillment.
 */
export function reconcileVerifiedPaidOrder(
  order: ShopifyPaidOrder,
  selection: CheckoutSelection,
  intakeId: string,
): PaidOrderMatch {
  if (!order || String(order.financial_status).toLowerCase() !== "paid") {
    throw new Error("ORDER_NOT_PAID");
  }
  if (!/^\d+$/.test(String(order.id)) || order.currency !== "USD") {
    throw new Error("INVALID_ORDER_ID_OR_CURRENCY");
  }
  if (!Array.isArray(order.line_items) || order.line_items.length !== 1) {
    throw new Error("SINGLE_SERVICE_ORDER_REQUIRED");
  }
  const item = order.line_items[0];
  if (!/^\d+$/.test(String(item.id)) || item.quantity !== 1) {
    throw new Error("INVALID_LINE_ITEM");
  }
  const variantId = String(item.variant_id);
  if (variantId !== selection.variantId || item.sku !== variantSkus[variantId]) {
    throw new Error("SHOPIFY_VARIANT_OR_SKU_MISMATCH");
  }
  const expectedCents = toCents(selection.amountUsd);
  if (toCents(item.price) !== expectedCents || toCents(order.total_price) !== expectedCents) {
    throw new Error("ORDER_AMOUNT_MISMATCH");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(intakeId)) {
    throw new Error("INVALID_INTAKE_ID");
  }
  const attributes = order.note_attributes;
  if (!Array.isArray(attributes)) throw new Error("INTAKE_REFERENCE_MISSING");
  const refs = attributes.filter(a => a?.name === "timeease_intake_id");
  if (refs.length !== 1 || refs[0].value !== intakeId) {
    throw new Error("INTAKE_REFERENCE_MISMATCH");
  }
  return { orderId: String(order.id), lineItemId: String(item.id), intakeId, variantId };
}
