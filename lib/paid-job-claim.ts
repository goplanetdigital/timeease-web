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
export async function claimPaidJob(intakeId:string,client?:Pick<Pool,'query'>):Promise<PaidJob|null>{
 const result=await (client??db()).query<PaidJob>(`UPDATE timeease_v2_orders
 SET status='PROCESSING',processing_started_at=now(),
 processing_attempts=processing_attempts+1
 WHERE intake_id=$1 AND status='PAID'
 AND source_manifest_path = 'intake-v2/' || intake_id::text || '/manifest.json'
 RETURNING intake_id,shopify_order_id,shopify_shop_domain,variant_id,
 amount_usd,customer_email,source_manifest_path,processing_attempts`,[intakeId]);
 return result.rowCount===1?result.rows[0]:null;
}
export async function markResultReady(intakeId:string,resultPath:string,client?:Pick<Pool,'query'>):Promise<boolean>{
 if(!resultPath.startsWith("results-v2/"+intakeId+"/")||resultPath.includes(".."))throw new Error("INVALID_RESULT_PATH");
 const result=await (client??db()).query(`UPDATE timeease_v2_orders SET result_path=$2
 WHERE intake_id=$1 AND status='PROCESSING' AND result_path IS NULL
 RETURNING intake_id`,[intakeId,resultPath]);
 return result.rowCount===1;
}

/** Finalize only after a durable result exists and the delivery provider confirms success. */
export async function markDelivered(intakeId:string,messageId:string,client?:Pick<Pool,'query'>):Promise<boolean>{
 if(!messageId||messageId.length>255)throw new Error("INVALID_DELIVERY_RECEIPT");
 const result=await (client??db()).query(`UPDATE timeease_v2_orders
 SET status='DELIVERED',delivery_message_id=$2,delivered_at=now(),last_error=NULL
 WHERE intake_id=$1 AND status='PROCESSING' AND result_path IS NOT NULL
 AND delivery_message_id IS NULL RETURNING intake_id`,[intakeId,messageId]);
 return result.rowCount===1;
}
/** Fail closed; do not automatically resend potentially delivered messages. */
export async function flagForReview(intakeId:string,reason:string,client?:Pick<Pool,'query'>):Promise<boolean>{
 if(!reason||reason.length>1000)throw new Error("INVALID_REVIEW_REASON");
 const result=await (client??db()).query(`UPDATE timeease_v2_orders
 SET status='REVIEW_REQUIRED',last_error=$2
 WHERE intake_id=$1 AND status='PROCESSING' RETURNING intake_id`,[intakeId,reason]);
 return result.rowCount===1;
}

/** Quarantine stalled processing jobs without retrying or resending customer email.
 * Invoke from a separately authenticated maintenance path after operational review.
 */
export async function quarantineStaleProcessingJobs(olderThanMinutes:number=15,limit:number=20):Promise<string[]>{
 if(!Number.isInteger(olderThanMinutes)||olderThanMinutes<10||olderThanMinutes>1440)throw new Error("INVALID_STALE_WINDOW");
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error("INVALID_STALE_LIMIT");
 const result=await db().query<{intake_id:string}>(`WITH stale AS (
 SELECT intake_id FROM timeease_v2_orders
 WHERE status='PROCESSING' AND processing_started_at < now()-($1::integer * interval '1 minute')
 ORDER BY processing_started_at ASC LIMIT $2 FOR UPDATE SKIP LOCKED
 ) UPDATE timeease_v2_orders o
 SET status='REVIEW_REQUIRED',last_error='PROCESSING_TIMEOUT_MANUAL_REVIEW_NO_AUTO_RESEND'
 FROM stale WHERE o.intake_id=stale.intake_id AND o.status='PROCESSING'
 RETURNING o.intake_id`,[olderThanMinutes,limit]);
 return result.rows.map(r=>r.intake_id);
}
