import type {Pool} from 'pg';
import {ORDER_FIXTURES} from './preview-order-fixture';
/** Preview adapter only. One fixed failure fixture; real ten-minute age, no clock override.
 * Uses its already-verified/locked client. Never opens an ambient database or requeues.
 * This is a scoped counterpart of quarantineStaleProcessingJobs, not its broad endpoint.
 */
export async function recoverPreviewFailure(id:string,client:Pick<Pool,'query'>):Promise<boolean>{
 if(id!==ORDER_FIXTURES.failure)throw Error('FAILURE_FIXTURE_REQUIRED');
 const r=await client.query(`UPDATE public.timeease_v2_orders
  SET status='REVIEW_REQUIRED',last_error='PROCESSING_TIMEOUT_MANUAL_REVIEW_NO_AUTO_RESEND'
  WHERE intake_id=$1 AND status='PROCESSING'
   AND processing_started_at < now() - interval '10 minutes'
   AND source_manifest_path='intake-v2/' || intake_id::text || '/manifest.json'
  RETURNING intake_id`,[id]);
 return r.rowCount===1;
}
