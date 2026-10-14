import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateQuote } from "../lib/upload-first-pricing";
import { reconcileVerifiedPaidOrder } from "../lib/shopify-paid-order-reconciliation";
import { resolveCheckoutSelection, verifyStoredIntake, type CheckoutSelection } from "../lib/checkout-readiness";

const intakeId = "12345678-1234-4123-8123-123456789abc";
const selection: CheckoutSelection = { service: "invoice", fileCount: 1, variantId: "51269543428343", amountUsd: 9 };
function paidOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "12345", financial_status: "paid", currency: "USD", total_price: "9.00",
    line_items: [{ id: "999", variant_id: selection.variantId, sku: "TIMEEASE-BASIC", quantity: 1, price: "9.00" }],
    note_attributes: [{ name: "timeease_intake_id", value: intakeId }],
    ...overrides,
  };
}
test("invoice tiers are server-priced", () => {
  assert.equal(calculateQuote({ service: "invoice", fileCount: 1, tier: "basic" }).amountUsd, 9);
  assert.equal(calculateQuote({ service: "invoice", fileCount: 1, tier: "complex" }).amountUsd, 39);
  assert.equal(calculateQuote({ service: "invoice", fileCount: 1, tier: "batch" }).amountUsd, 99);
  assert.throws(() => calculateQuote({ service: "invoice", fileCount: 2, tier: "basic" }));
});
test("consolidation count determines the exact price", () => {
  assert.equal(calculateQuote({ service: "consolidation", fileCount: 10 }).amountUsd, 9);
  assert.equal(calculateQuote({ service: "consolidation", fileCount: 11 }).amountUsd, 10);
  assert.equal(calculateQuote({ service: "consolidation", fileCount: 100 }).amountUsd, 99);
  assert.throws(() => calculateQuote({ service: "consolidation", fileCount: 101 }));
});
test("paid order matches only the trusted intake and exact variant", () => {
  assert.equal(reconcileVerifiedPaidOrder(paidOrder(), selection, intakeId).intakeId, intakeId);
  assert.throws(() => reconcileVerifiedPaidOrder(paidOrder({ financial_status: "pending" }), selection, intakeId));
  assert.throws(() => reconcileVerifiedPaidOrder(paidOrder({ total_price: "8.00" }), selection, intakeId));
  assert.throws(() => reconcileVerifiedPaidOrder(paidOrder({ currency: "MYR" }), selection, intakeId));
  assert.throws(() => reconcileVerifiedPaidOrder(paidOrder({ note_attributes: [] }), selection, intakeId));
  assert.throws(() => reconcileVerifiedPaidOrder(paidOrder({ note_attributes: [
    { name: "timeease_intake_id", value: intakeId },
    { name: "timeease_intake_id", value: intakeId },
  ] }), selection, intakeId));
  assert.throws(() => reconcileVerifiedPaidOrder(paidOrder({ line_items: [
    { id: "999", variant_id: selection.variantId, sku: "TIMEEASE-BASIC", quantity: 2, price: "9.00" },
  ] }), selection, intakeId));
});

test("checkout selection uses exact server-controlled variant IDs", () => {
  assert.equal(resolveCheckoutSelection({ service: "invoice", fileCount: 1, tier: "basic" }).variantId, "51269543428343");
  assert.equal(resolveCheckoutSelection({ service: "catalogue", fileCount: 1, catalogueRows: 501 }).variantId, "51293145825527");
  assert.equal(resolveCheckoutSelection({ service: "resume", fileCount: 1, tier: "full" }).variantId, "51293146120439");
  assert.throws(() => resolveCheckoutSelection({ service: "consolidation", fileCount: 11 }), /CONSOLIDATION_VARIANT_LOOKUP_REQUIRED/);
});
test("stored intake quote and files cannot be silently changed before checkout", () => {
  const input = { service: "invoice" as const, fileCount: 1, tier: "basic" as const };
  const manifest = {
    status: "AWAITING_PAYMENT", checkoutOrderId: null, service: "invoice",
    quoteInput: input, quote: calculateQuote(input),
    files: [{ pathname: "intake-v2/123/file-001.pdf", bytes: 200 }],
  };
  assert.equal(verifyStoredIntake(manifest).amountUsd, 9);
  assert.throws(() => verifyStoredIntake({ ...manifest, quote: { ...manifest.quote, amountUsd: 1 } }));
  assert.throws(() => verifyStoredIntake({ ...manifest, status: "PAID" }));
  assert.throws(() => verifyStoredIntake({ ...manifest, files: [...manifest.files, ...manifest.files] }));
  assert.throws(() => verifyStoredIntake({ ...manifest, files: [{ ...manifest.files[0], bytes: 0 }] }));
});
