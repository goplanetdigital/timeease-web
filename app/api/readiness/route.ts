import {NextResponse} from "next/server";
export const runtime="nodejs";
export async function GET(){
 const privateStorageConfigured=Boolean(process.env.BLOB_READ_WRITE_TOKEN);
 const shopifyWebhookSecretConfigured=Boolean(process.env.SHOPIFY_WEBHOOK_SECRET);
 const checkoutBindingConfigured=Boolean(process.env.TIMEEASE_CHECKOUT_BINDING_SECRET);
 const shopDomainConfigured=Boolean(process.env.SHOPIFY_SHOP_DOMAIN);
 const checkoutRequested=process.env.TIMEEASE_V2_CHECKOUT_ENABLED==="true";
 const deliveryVerified=process.env.TIMEEASE_V2_DELIVERY_VERIFIED==="true";
 const checkoutEnabled=privateStorageConfigured&&shopifyWebhookSecretConfigured&&checkoutBindingConfigured&&shopDomainConfigured&&checkoutRequested&&deliveryVerified;
 return NextResponse.json({
  service:"timeease-upload-first",
  privateStorageConfigured,
  intakeEnabled:privateStorageConfigured,
  shopifyWebhookSecretConfigured,
  checkoutBindingConfigured,
  shopDomainConfigured,
  checkoutRequested,
  checkoutEnabled,
  paymentWebhookVerified:false,
  workerDeliveryVerified:deliveryVerified,
  launchReady:false
 },{headers:{"Cache-Control":"no-store, max-age=0"}});
}
