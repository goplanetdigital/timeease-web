import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a Shopify webhook BEFORE parsing JSON or trusting order fields.
 * Shopify's X-Shopify-Hmac-Sha256 is Base64(HMAC-SHA256(rawBody, secret)).
 * This helper does not process orders or trigger any n8n workflow.
 */
export function verifyShopifyWebhookHmac(
  rawBody: Buffer,
  header: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !header || !Buffer.isBuffer(rawBody)) return false;
  const value = header.trim();
  // SHA-256 digest is exactly 32 bytes, represented as 44 Base64 characters.
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) return false;
  const provided = Buffer.from(value, "base64");
  if (provided.length !== 32 || provided.toString("base64") !== value) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return timingSafeEqual(expected, provided);
}
