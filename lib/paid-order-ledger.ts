import {Pool} from "pg";
import type {CheckoutTokenPayload} from "./checkout-binding.ts";

let pool:Pool|undefined;
function database():Pool{
 const connectionString=process.env.TIMEEASE_DB_DATABASE_URL;
 if(!connectionString)throw new Error("PAYMENT_DATABASE_NOT_CONFIGURED");
 return pool??=new Pool({connectionString,max:3,connectionTimeoutMillis:5000});
}
export async function recordVerifiedPayment(
 binding:CheckoutTokenPayload,
 orderId:string,
 shop:string,
 email:string|null
):Promise<"CREATED"|"ALREADY_RECORDED">{
 if(!/^[0-9]+$/.test(orderId)||!shop||!binding.intakeId)throw new Error("INVALID_VERIFIED_ORDER");
 const sql=`INSERT INTO timeease_v2_orders
 (intake_id,shopify_order_id,shopify_shop_domain,variant_id,amount_usd,customer_email,source_manifest_path,status)
 VALUES ($1,$2,$3,$4,$5,$6,$7,'PAID')
 ON CONFLICT DO NOTHING RETURNING intake_id`;
 const args=[binding.intakeId,orderId,shop,binding.variantId,binding.amountUsd,email,
  "intake-v2/"+binding.intakeId+"/manifest.json"];
 const db=database();
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
