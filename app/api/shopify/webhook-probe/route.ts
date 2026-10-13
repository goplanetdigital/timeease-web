import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhookHmac } from "../../../../lib/shopify-webhook-auth";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const MAX_BYTES = 256 * 1024;

/**
 * Staging-only webhook authentication probe.
 * Does not create jobs, mutate manifests, or acknowledge fulfillment.
 * IMPORTANT: Do not register this URL as a live Shopify orders/paid webhook
 * until atomic deduplication and paid-order reconciliation are integrated.
 */
export async function POST(req: NextRequest) {
  if (process.env.TIMEEASE_SHOPIFY_WEBHOOK_PROBE !== "enabled") {
    return NextResponse.json({ error: "NOT_ENABLED" }, { status: 503, headers });
  }
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503, headers });
  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
    return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413, headers });
  }
  const raw = Buffer.from(await req.arrayBuffer());
  if (raw.length > MAX_BYTES) {
    return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413, headers });
  }
  if (!verifyShopifyWebhookHmac(raw, req.headers.get("x-shopify-hmac-sha256"), secret)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
  }
  // This endpoint intentionally does NOT return HTTP 2xx: a valid signature
  // alone is insufficient proof of a correctly priced, single-use paid order.
  return NextResponse.json({ error: "FULFILLMENT_NOT_ENABLED" }, { status: 503, headers });
}
