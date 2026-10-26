import {Pool} from 'pg';
import {list} from '@vercel/blob';
import {isIsolatedPreview} from './test-worker-guards';
export const PREVIEW_BLOB_STORE='store_FI8APVuc1xuRZkAg';
const PREVIEW_HOST='ep-summer-salad-aoeax66z.c-2.ap-southeast-1.aws.neon.tech';
/** Never supplies the inherited production read-write token in Preview. */
export function previewBlobOptions(env:Record<string,string|undefined>){
 if(!isIsolatedPreview(env)||env.TIMEEASE_PREVIEW_BLOB_STORE_ID!==PREVIEW_BLOB_STORE||!env.VERCEL_OIDC_TOKEN?.trim())
  throw Error('PREVIEW_BLOB_OIDC_REQUIRED');
 return {storeId:PREVIEW_BLOB_STORE};
}
/** Boolean-only operational evidence; no order rows, object names or credentials. */
export async function previewRuntimeEvidence(env:Record<string,string|undefined>){
 const evidence={readOnly:true,database:{queryVerified:false,identityVerified:false,leastPrivilegeVerified:false,tlsActive:false,tlsCertificateVerified:false,readOnlyTransaction:false},blob:{storeMatched:env.TIMEEASE_PREVIEW_BLOB_STORE_ID===PREVIEW_BLOB_STORE,oidcConfigured:Boolean(env.VERCEL_OIDC_TOKEN?.trim()),readVerified:false,productionTokenUsed:false,writeVerified:false}};
 if(!isIsolatedPreview(env))return evidence;
 await Promise.all([
  (async()=>{
   let url:URL;
   try{url=new URL(env.TIMEEASE_DB_DATABASE_URL||'');}catch{return;}
   if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!==PREVIEW_HOST||url.username!=='timeease_worker_limited'||url.pathname!=='/neondb')return;
   url.searchParams.set('sslmode','verify-full');
   const pool=new Pool({connectionString:url.toString(),max:1,connectionTimeoutMillis:4000,statement_timeout:4000,query_timeout:5000});
   try{
    const client=await pool.connect();
    try{
     await client.query('BEGIN READ ONLY');
     const result=await client.query(`SELECT current_user AS role,current_database() AS database,
      current_setting('neon.project_id',true) AS project_id,current_setting('neon.branch_id',true) AS branch_id,
      current_setting('transaction_read_only')='on' AS read_only,
      (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls_active,
      (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolreplication FROM pg_roles WHERE rolname=current_user) AS elevated,
      pg_has_role(current_user,'neon_superuser','MEMBER') AS neon_superuser_member,
      has_table_privilege(current_user,'public.timeease_v2_orders','SELECT') AS can_select,
      has_table_privilege(current_user,'public.timeease_v2_orders','INSERT') OR has_table_privilege(current_user,'public.timeease_v2_orders','DELETE') OR has_table_privilege(current_user,'public.timeease_v2_orders','TRUNCATE') AS forbidden_write`);
     const row=result.rows[0];
     evidence.database.queryVerified=Boolean(row);
     evidence.database.identityVerified=row?.role==='timeease_worker_limited'&&row?.database==='neondb'&&row?.project_id==='odd-base-63790740'&&row?.branch_id==='br-rough-butterfly-aox5mukp';
     evidence.database.leastPrivilegeVerified=row?.elevated===false&&row?.neon_superuser_member===false&&row?.can_select===true&&row?.forbidden_write===false;
     evidence.database.readOnlyTransaction=row?.read_only===true;
     evidence.database.tlsActive=row?.tls_active===true;
     evidence.database.tlsCertificateVerified=(client.connection.stream as unknown as {authorized?:boolean}).authorized===true;
    }finally{await client.query('ROLLBACK').catch(()=>{});client.release();}
   }catch{/* Deliberately return no database errors or connection details. */}
   finally{await pool.end().catch(()=>{});}
  })(),
  (async()=>{
   try{
    const options=previewBlobOptions(env);
    // Read only an empty diagnostic namespace; never return names or object data.
    await list({...options,prefix:'preview-isolation-check/',limit:1,abortSignal:AbortSignal.timeout(5000)});
    evidence.blob.readVerified=true;
   }catch{/* No token fallback or raw provider errors in the response. */}
  })()
 ]);
 return evidence;
}
