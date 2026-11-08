import {Pool,type PoolClient} from 'pg';
import {productionReleaseBound,PRODUCTION_NEON_PROJECT,PRODUCTION_NEON_BRANCH} from './production-release';
import {requireV2OutboxSchema} from './v2-delivery-outbox';
export type TransactionClient=Pick<PoolClient,'query'>;
export type DatabasePurpose='worker'|'payment';
export function productionConnection(purpose:DatabasePurpose,env:NodeJS.ProcessEnv=process.env):string{
 if(!productionReleaseBound(env))throw Error('PRODUCTION_RELEASE_NOT_BOUND');
 // Keep purpose credentials independent; never fall back to the shared legacy
 // URL or rewrite its Preview/Production scopes at runtime.
 const raw=purpose==='worker'?env.TIMEEASE_WORKER_DATABASE_URL:env.TIMEEASE_PAYMENT_DATABASE_URL;
 let url:URL;try{url=new URL(raw||'');}catch{throw Error('PRODUCTION_DATABASE_NOT_CONFIGURED');}
 const role=purpose==='worker'?'timeease_worker_limited':'timeease_payment_limited';
 if(!['postgres:','postgresql:'].includes(url.protocol)||decodeURIComponent(url.username)!==role||
  !url.hostname.endsWith('.neon.tech')||url.pathname!=='/neondb'||
  !(url.searchParams.get('password')||url.password))throw Error('PRODUCTION_DATABASE_SCOPE_REQUIRED');
 url.searchParams.set('sslmode','verify-full');return url.toString();
}
export async function assertProductionDatabase(client:TransactionClient,purpose:DatabasePurpose):Promise<void>{
 const q=await client.query(`SELECT current_database() AS database,current_user AS role,
 current_setting('neon.project_id',true) AS project,current_setting('neon.branch_id',true) AS branch,
 (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolreplication FROM pg_roles WHERE rolname=current_user) AS elevated,
 pg_has_role(current_user,'neon_superuser','MEMBER') AS member,
 has_table_privilege(current_user,'public.timeease_v2_orders','DELETE') OR
 has_table_privilege(current_user,'public.timeease_v2_orders','TRUNCATE') AS forbidden,
 has_table_privilege(current_user,'public.timeease_v2_orders','INSERT') AS can_insert_orders,
 has_column_privilege(current_user,'public.timeease_v2_orders','intake_id','UPDATE') OR
 has_column_privilege(current_user,'public.timeease_v2_orders','shopify_order_id','UPDATE') OR
 has_column_privilege(current_user,'public.timeease_v2_orders','source_manifest_path','UPDATE') AS can_update_binding`);
 const r=q.rows[0];const role=purpose==='worker'?'timeease_worker_limited':'timeease_payment_limited';
 if(r?.database!=='neondb'||r.role!==role||r.project!==PRODUCTION_NEON_PROJECT||r.branch!==PRODUCTION_NEON_BRANCH||
  r.elevated!==false||r.member!==false||r.forbidden!==false||r.can_update_binding!==false||(purpose==='worker'&&r.can_insert_orders!==false))throw Error('PRODUCTION_DATABASE_IDENTITY_REQUIRED');
 if(purpose==='worker')await requireV2OutboxSchema(client);
 else{
  const f=await client.query(`SELECT
   (SELECT count(*)=2 FROM pg_constraint c WHERE conname IN ('timeease_fulfillment_outbox_intake_id_fkey','timeease_delivery_ledger_intake_id_fkey')
    AND conrelid IN ('public.timeease_fulfillment_outbox'::regclass,'public.timeease_delivery_ledger'::regclass)
    AND contype='f' AND convalidated AND confrelid='public.timeease_v2_orders'::regclass
    AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='intake_id')]::smallint[]
    AND confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.confrelid AND attname='intake_id')]::smallint[]) AND
   (SELECT count(*)=5 FROM pg_constraint WHERE conrelid IN ('public.timeease_fulfillment_outbox'::regclass,'public.timeease_delivery_ledger'::regclass)
    AND contype IN ('p','u') AND convalidated) AS ready`);
  if(f.rows[0]?.ready!==true)throw Error('OUTBOX_SCHEMA_NOT_READY');
 }
 // Missing migration/permissions fail before touching any order or Blob.
 await client.query('SELECT shopify_order_id FROM public.timeease_payment_holds LIMIT 0');
}
export async function productionTransaction<T>(purpose:DatabasePurpose,fn:(client:TransactionClient)=>Promise<T>):Promise<T>{
 const pool=new Pool({connectionString:productionConnection(purpose),max:1,connectionTimeoutMillis:4000,statement_timeout:5000});
 let client:PoolClient|undefined;
 try{client=await pool.connect();await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='3s'");await client.query("SET LOCAL idle_in_transaction_session_timeout='10s'");
  await assertProductionDatabase(client,purpose);const value=await fn(client);await client.query('COMMIT');return value;
 }catch(error){await client?.query('ROLLBACK').catch(()=>{});throw error;}
 finally{client?.release();await pool.end();}
}
// The lock is shared by payment/reversal and Worker operations for one order.
export async function lockPayment(shop:string,orderId:string,client:TransactionClient):Promise<void>{
 await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[shop+':'+orderId]);
}
export async function paymentHeld(shop:string,orderId:string,client:TransactionClient):Promise<boolean>{
 return (await client.query('SELECT 1 FROM public.timeease_payment_holds WHERE shop_domain=$1 AND shopify_order_id=$2',[shop,orderId])).rowCount!==0;
}
export async function withProductionOrder<T>(id:string,fn:(client:TransactionClient,held:boolean)=>Promise<T>):Promise<T>{
 return productionTransaction('worker',async client=>{
  const row=(await client.query('SELECT shopify_shop_domain,shopify_order_id FROM public.timeease_v2_orders WHERE intake_id=$1',[id])).rows[0];
  if(!row)throw Error('ORDER_NOT_FOUND');await lockPayment(row.shopify_shop_domain,row.shopify_order_id,client);
  await client.query('SELECT intake_id FROM public.timeease_v2_orders WHERE intake_id=$1 FOR UPDATE',[id]);
  return fn(client,await paymentHeld(row.shopify_shop_domain,row.shopify_order_id,client));
 });
}

export async function verifyProductionPool(pool:Pool):Promise<void>{
 const c=await pool.connect();try{await assertProductionDatabase(c,"worker");}finally{c.release();}
}
