import {Pool} from "pg";

/** A read-only production check; never creates or changes schema. */
export async function paymentLedgerSchemaReady():Promise<boolean>{
 const connectionString=process.env.TIMEEASE_DB_DATABASE_URL;
 if(!connectionString)return false;
 const pool=new Pool({connectionString,max:1,connectionTimeoutMillis:3500,idleTimeoutMillis:1000});
 try{
  const result=await pool.query<{ready:boolean}>(`
 SELECT (
  to_regclass('public.timeease_v2_orders') IS NOT NULL
  AND (SELECT count(*)::int FROM information_schema.columns
       WHERE table_schema='public' AND table_name='timeease_v2_orders'
       AND column_name IN ('intake_id','shopify_order_id','shopify_shop_domain',
         'variant_id','amount_usd','customer_email','source_manifest_path',
         'result_path','delivery_message_id','processing_attempts','status',
         'processing_started_at','delivered_at','last_error'))=14
 ) AS ready`);
  return result.rows[0]?.ready===true;
 }catch{return false}finally{await pool.end().catch(()=>{});}
}
