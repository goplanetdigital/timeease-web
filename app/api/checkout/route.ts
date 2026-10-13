import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { verifyStoredIntake } from "../../../lib/checkout-readiness";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
    const manifest = JSON.parse(await new Response(blob.stream).text());
    if (manifest?.id !== id) {
      return NextResponse.json({ error: "INTAKE_ID_MISMATCH" }, { status: 409, headers: NO_STORE });
    }
    try {
      verifyStoredIntake(manifest);
    } catch {
      // Avoid leaking product/order details from private manifests.
      return NextResponse.json({ error: "INTAKE_NOT_READY" }, { status: 409, headers: NO_STORE });
    }
    // Deliberately do not redirect: checkout sessions still require signed
    // single-use binding and verified paid-order reconciliation.
    return NextResponse.json({ error: "CHECKOUT_NOT_YET_ENABLED" }, { status: 503, headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "CHECKOUT_PREFLIGHT_FAILED" }, { status: 500, headers: NO_STORE });
  }
}
