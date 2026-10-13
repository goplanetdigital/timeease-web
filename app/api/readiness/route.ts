import {NextResponse} from "next/server";
export const runtime="nodejs";
export async function GET(){
 const privateStorageConfigured=Boolean(process.env.BLOB_READ_WRITE_TOKEN);
 const shopifyWebhookSecretConfigured=Boolean(process.env.SHOPIFY_WEBHOOK_SECRET);
 // Do not expose environment values or internal secrets.
 return NextResponse.json({
  service:"timeease-upload-first",
  privateStorageConfigured,
  intakeEnabled:privateStorageConfigured,
  shopifyWebhookSecretConfigured,
  checkoutEnabled:false,
  paymentWebhookVerified:false,
  workerDeliveryVerified:false,
  launchReady:false
 },{headers:{"Cache-Control":"no-store, max-age=0"}});
}
