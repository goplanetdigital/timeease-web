import {previewRuntimeEvidence} from "../../../lib/preview-runtime-evidence";
import {previewBlobAccessBlocked} from "../../../lib/preview-blob-guard";
import {NextResponse} from "next/server";
import {checkoutIsEnabled,checkoutTestPrerequisitesReady} from "../../../lib/checkout-readiness";
import {paymentLedgerSchemaReady} from "../../../lib/payment-ledger-schema-ready";
export const runtime="nodejs";
export async function GET(){
 const privateStorageConfigured=Boolean(process.env.BLOB_READ_WRITE_TOKEN);
 const shopifyWebhookSecretConfigured=Boolean(process.env.SHOPIFY_WEBHOOK_SECRET);
 const checkoutBindingConfigured=Boolean(process.env.TIMEEASE_CHECKOUT_BINDING_SECRET);
 const shopDomainConfigured=Boolean(process.env.SHOPIFY_SHOP_DOMAIN);
 const checkoutRequested=process.env.TIMEEASE_V2_CHECKOUT_ENABLED==="true";
 const deliveryVerified=process.env.TIMEEASE_V2_DELIVERY_VERIFIED==="true";
 const paymentLedgerConfigured=Boolean(process.env.TIMEEASE_DB_DATABASE_URL);
 const paymentLedgerEnabled=process.env.TIMEEASE_V2_PAYMENT_LEDGER_ENABLED==="true";
 const previewIsolation=process.env.VERCEL_ENV==="preview"?await previewRuntimeEvidence(process.env):undefined;
 const paymentLedgerSchemaVerified=process.env.VERCEL_ENV==="preview"?false:await paymentLedgerSchemaReady();
 const checkoutEnabled=checkoutIsEnabled()&&paymentLedgerSchemaVerified;
 return NextResponse.json({
  service:"timeease-upload-first",
  ...(previewIsolation?{previewIsolation}:{}),
  privateStorageConfigured,
  intakeEnabled:privateStorageConfigured&&!previewBlobAccessBlocked(process.env),
  previewBlobAccessBlocked:previewBlobAccessBlocked(process.env),
  shopifyWebhookSecretConfigured,
  checkoutBindingConfigured,
  shopDomainConfigured,
  checkoutRequested,
  paymentLedgerConfigured,
  paymentLedgerEnabled,
  paymentLedgerSchemaVerified,
  paidTestPrerequisitesReady:checkoutTestPrerequisitesReady()&&paymentLedgerSchemaVerified,
  checkoutEnabled,
  paymentWebhookVerified:false,
  workerDeliveryVerified:deliveryVerified,
  launchReady:false
 },{headers:{"Cache-Control":"no-store, max-age=0"}});
}
