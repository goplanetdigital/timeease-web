import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { verifyStoredIntake } from "../../../lib/checkout-readiness";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400, headers: NO_STORE });
    }
    const id = body?.id;
    if (typeof id !== "string" || !UUID.test(id)) {
      return NextResponse.json({ error: "INVALID_INTAKE_ID" }, { status: 400, headers: NO_STORE });
    }
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "STORAGE_NOT_CONFIGURED" }, { status: 503, headers: NO_STORE });
    }
    const blob = await get(`intake-v2/${id}/manifest.json`, { access: "private", token });
    if (!blob?.stream) {
      return NextResponse.json({ error: "INTAKE_NOT_FOUND" }, { status: 404, headers: NO_STORE });
    }
    // Bound manifest size to prevent unexpectedly large JSON responses.
    const manifestResponse = new Response(blob.stream);
    const reader = manifestResponse.body?.getReader();
    if (!reader) return NextResponse.json({ error: "INTAKE_NOT_READY" }, { status: 409, headers: NO_STORE });
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > 100_000) {
        await reader.cancel();
        return NextResponse.json({ error: "INTAKE_NOT_READY" }, { status: 409, headers: NO_STORE });
      }
      chunks.push(value);
    }
    const manifestText = Buffer.concat(chunks).toString("utf8");
    if (manifestText.length > 100_000) {
      return NextResponse.json({ error: "INTAKE_NOT_READY" }, { status: 409, headers: NO_STORE });
    }
    const manifest = JSON.parse(manifestText);
    // Only an intact manifest can proceed to checkout preflight.
    if (manifest?.id !== id) {
      return NextResponse.json({ error: "INTAKE_ID_MISMATCH" }, { status: 409, headers: NO_STORE });
    }
    let selection;
    try {
      selection = verifyStoredIntake(manifest);
      // All stored files must belong to the same private intake namespace.
      const expectedPrefix = `intake-v2/${id}/`;
      if (!manifest.files.every((file: unknown) => {
        if (!file || typeof file !== "object") return false;
        const item = file as Record<string, unknown>;
        return typeof item.pathname === "string" &&
          item.pathname.startsWith(expectedPrefix) &&
          !item.pathname.includes("..") &&
          typeof item.bytes === "number" && item.bytes > 0;
      })) throw new Error("INVALID_FILE_OWNERSHIP");
      if (!selection.variantId || selection.amountUsd <= 0) throw new Error("INVALID_SELECTION");
    } catch {
      // Avoid leaking product/order details from private manifests.
      return NextResponse.json({ error: "INTAKE_NOT_READY" }, { status: 409, headers: NO_STORE });
    }
    // A successful preflight is not an authorization to charge: the paid-order
    // worker currently interprets timeease_token as a post-payment upload token,
    // not a pre-upload private Blob manifest identifier. Never expose the UUID
    // as a Shopify note attribute until an authenticated reconciliation path
    // validates the paid order, SKU, amount, currency, and single-use intake.
    // Deliberately do not redirect: checkout sessions still require signed
    // single-use binding and verified paid-order reconciliation.
    return NextResponse.json({ error: "CHECKOUT_NOT_YET_ENABLED" }, { status: 503, headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "CHECKOUT_PREFLIGHT_FAILED" }, { status: 500, headers: NO_STORE });
  }
}
