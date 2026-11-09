import {Pool,PoolClient} from 'pg';
import {REVERSAL_LOGIN} from './preview-shopify-reversal';
import {RESUME_HOST} from './isolated-delivery-fixtures';
import {PREVIEW_NEON_PROJECT,PREVIEW_NEON_BRANCH} from './test-worker-guards';
/** Reuse existing Preview-only login; no password/role provisioning or owner fallback. */
export async function isolatedPaymentConnection(env:NodeJS.ProcessEnv){
 const url=new URL(env.TIMEEASE_PREVIEW_REVERSAL_DATABASE_URL||'');
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!==RESUME_HOST||url.username!==REVERSAL_LOGIN||url.pathname!=='/neondb'||!url.password)throw Error('PREVIEW_PAYMENT_SCOPE_REQUIRED');
 url.searchParams.set('sslmode','verify-full');
 const pool=new Pool({connectionString:url.toString(),max:1,connectionTimeoutMillis:4000,statement_timeout:5000});let c:PoolClient|undefined;
 try{
  c=await pool.connect();const tls=c.connection.stream as unknown as {encrypted?:boolean;authorized?:boolean;getProtocol?:()=>string|null};
  if(tls.encrypted!==true||tls.authorized!==true||!['TLSv1.2','TLSv1.3'].includes(tls.getProtocol?.()||''))throw Error('VERIFIED_TLS_REQUIRED');
  await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='3s'");await c.query("SET LOCAL idle_in_transaction_session_timeout='10s'");
  const who=(await c.query("SELECT current_database() AS database,session_user AS login,current_setting('neon.project_id',true) AS project,current_setting('neon.branch_id',true) AS branch")).rows[0];
  if(who?.database!=='neondb'||who.login!==REVERSAL_LOGIN||who.project!==PREVIEW_NEON_PROJECT||who.branch!==PREVIEW_NEON_BRANCH)throw Error('EXACT_PREVIEW_IDENTITY_REQUIRED');
  await c.query('SET LOCAL ROLE timeease_payment_limited');
  const r=(await c.query(`SELECT current_user AS role,
   (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolreplication FROM pg_roles WHERE rolname=current_user) AS elevated,
   pg_has_role(current_user,'neon_superuser','MEMBER') AS member,
   has_table_privilege(current_user,'public.timeease_v2_orders','DELETE') OR has_table_privilege(current_user,'public.timeease_v2_orders','TRUNCATE') AS forbidden`)).rows[0];
  if(r?.role!=='timeease_payment_limited'||r.elevated!==false||r.member!==false||r.forbidden!==false)throw Error('LIMITED_PAYMENT_ROLE_REQUIRED');
  return {pool,c};
 }catch(error){await c?.query('ROLLBACK').catch(()=>{});c?.release();await pool.end().catch(()=>{});throw error;}
}
