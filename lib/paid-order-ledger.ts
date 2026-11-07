import {productionTransaction,lockPayment,paymentHeld,type TransactionClient} from "./production-database";
import type {CheckoutTokenPayload} from "./checkout-binding.ts";

export async function recordVerifiedPayment(
 binding:CheckoutTokenPayload,
 orderId:string,
 shop:string,
 email:string|null,
 client?:TransactionClient
):Promise<"CREATED"|"ALREADY_RECORDED"|"PAYMENT_HELD">{
 if(!/^[0-9]+$/.test(orderId)||!shop||!binding.intakeId)throw new Error("INVALID_VERIFIED_ORDER");
 if(!client)return productionTransaction("payment",c=>recordVerifiedPayment(binding,orderId,shop,email,c));
 await lockPayment(shop,orderId,client);
 if(await paymentHeld(shop,orderId,client))return "PAYMENT_HELD";
 const sql=`INSERT INTO timeease_v2_orders
 (intake_id,shopify_order_id,shopify_shop_domain,variant_id,amount_usd,customer_email,source_manifest_path,status)
 VALUES ($1,$2,$3,$4,$5,$6,$7,'PAID')
 ON CONFLICT DO NOTHING RETURNING intake_id`;
 const args=[binding.intakeId,orderId,shop,binding.variantId,binding.amountUsd,email,
  "intake-v2/"+binding.intakeId+"/manifest.json"];
 const db=client;
 const inserted=await db.query(sql,args);
 if(inserted.rowCount===1)return "CREATED";
 const existing=await db.query(
  "SELECT intake_id,shopify_order_id,shopify_shop_domain,variant_id,amount_usd,source_manifest_path FROM timeease_v2_orders WHERE intake_id=$1 OR shopify_order_id=$2",
  [binding.intakeId,orderId]);
 if(existing.rowCount!==1)throw new Error("PAYMENT_BINDING_CONFLICT");
 const row=existing.rows[0] as {intake_id:string;shopify_order_id:string;shopify_shop_domain:string;variant_id:string;amount_usd:number;source_manifest_path:string};
 if(row.intake_id!==binding.intakeId||row.source_manifest_path!=="intake-v2/"+binding.intakeId+"/manifest.json"||
 row.shopify_order_id!==orderId||row.shopify_shop_domain!==shop||
 row.variant_id!==binding.variantId||Number(row.amount_usd)!==binding.amountUsd)throw new Error("PAYMENT_BINDING_CONFLICT");
 return "ALREADY_RECORDED";
}
