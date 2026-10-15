import {Pool} from "pg";

let pool:Pool|undefined;
function db():Pool{
 const connectionString=process.env.TIMEEASE_DB_DATABASE_URL;
 if(!connectionString)throw new Error("PAYMENT_DATABASE_NOT_CONFIGURED");
 return pool??=new Pool({connectionString,max:3,connectionTimeoutMillis:5000});
}
export type PaidJob={
 intake_id:string;shopify_order_id:string;shopify_shop_domain:string;
 variant_id:string;amount_usd:number;customer_email:string|null;
 source_manifest_path:string;processing_attempts:number;
};
/** Claim one paid order atomically. Never run a job without a returned row. */
export async function claimPaidJob(intakeId:string):Promise<PaidJob|null>{
 const result=await db().query<PaidJob>(`UPDATE timeease_v2_orders
 SET status='PROCESSING',processing_started_at=now(),
 processing_attempts=processing_attempts+1
 WHERE intake_id=$1 AND status='PAID'
 RETURNING intake_id,shopify_order_id,shopify_shop_domain,variant_id,
 amount_usd,customer_email,source_manifest_path,processing_attempts`,[intakeId]);
 return result.rowCount===1?result.rows[0]:null;
}
export async function markResultReady(intakeId:string,resultPath:string):Promise<boolean>{
 if(!resultPath.startsWith("results-v2/"+intakeId+"/")||resultPath.includes(".."))throw new Error("INVALID_RESULT_PATH");
 const result=await db().query(`UPDATE timeease_v2_orders SET result_path=$2
 WHERE intake_id=$1 AND status='PROCESSING' AND result_path IS NULL
 RETURNING intake_id`,[intakeId,resultPath]);
 return result.rowCount===1;
}
