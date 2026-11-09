import {NextRequest,NextResponse} from 'next/server';
import {Pool} from 'pg';
import {createHash,timingSafeEqual} from 'node:crypto';
import {isIsolatedPreview,isIsolatedNeonEndpoint,PREVIEW_NEON_BRANCH,PREVIEW_NEON_PROJECT} from '../../../../lib/test-worker-guards';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function respond(error:string,status:number){return NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});}
export async function GET(request:NextRequest){
 if(!isIsolatedPreview(process.env)) return respond('ISOLATION_REQUIRED',503);
 const secret=process.env.TIMEEASE_TEST_WORKER_SECRET;
 if(!secret||secret.length<32)return respond('TEST_AUTH_MISSING',503);
 const bearer=request.headers.get('authorization')||'';
 if(!bearer.startsWith('Bearer ')||bearer.length>519)return respond('UNAUTHORIZED',401);
 const actual=createHash('sha256').update(bearer.slice(7)).digest();
 const expected=createHash('sha256').update(secret).digest();
 if(!timingSafeEqual(actual,expected))return respond('UNAUTHORIZED',401);
 const raw=process.env.TIMEEASE_DB_DATABASE_URL;
 if(!raw)return respond('TEST_DATABASE_MISSING',503);
 let url:URL;
 try{url=new URL(raw);}catch{return respond('TEST_DATABASE_INVALID',503);}
 if(url.protocol!=='postgres:'&&url.protocol!=='postgresql:')return respond('TEST_DATABASE_INVALID',503);
 // Fail closed before opening any connection to a non-Preview endpoint.
 if(!isIsolatedNeonEndpoint(url.hostname))return respond('TEST_ENDPOINT_MISMATCH',503);
 if(url.username!=='timeease_worker_limited'||url.pathname!=='/neondb')return respond('TEST_CONNECTION_IDENTITY_MISMATCH',503);
 url.searchParams.set('sslmode','verify-full');
 const pool=new Pool({connectionString:url.toString(),max:1,connectionTimeoutMillis:4000});
 try{
  const client=await pool.connect();
  try{
   const result=await client.query(`SELECT current_database() AS database,current_user AS role,
     (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls_active,
     (SELECT version FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls_version,
     current_setting('neon.branch_id',true) AS branch_id,
     current_setting('neon.project_id',true) AS project_id,
     (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolreplication
       FROM pg_roles WHERE rolname=current_user) AS elevated,
     pg_has_role(current_user,'neon_superuser','MEMBER') AS neon_superuser_member,
     has_table_privilege(current_user,'public.timeease_v2_orders','SELECT') AS can_select,
     has_table_privilege(current_user,'public.timeease_v2_orders','INSERT') OR
     has_table_privilege(current_user,'public.timeease_v2_orders','DELETE') OR
     has_table_privilege(current_user,'public.timeease_v2_orders','TRUNCATE') AS forbidden_write`);
   const row=result.rows[0];
   if(row?.role!=='timeease_worker_limited'||row?.database!=='neondb')return respond('TEST_ROLE_MISMATCH',503);
   if(row?.branch_id!==PREVIEW_NEON_BRANCH||row?.project_id!==PREVIEW_NEON_PROJECT)return respond('TEST_BRANCH_MISMATCH',503);
   if(row?.elevated!==false||row?.neon_superuser_member!==false||row?.forbidden_write!==false||row?.can_select!==true)return respond('TEST_LEAST_PRIVILEGE_REQUIRED',503);
   const stream=client.connection.stream as unknown as {authorized?:boolean;encrypted?:boolean;getProtocol?:()=>string|null};
   const tlsVersion=stream.getProtocol?.()||'';
   if(stream.encrypted!==true||!['TLSv1.2','TLSv1.3'].includes(tlsVersion))return respond('TEST_TLS_REQUIRED',503);
   if(stream.authorized!==true)return respond('TEST_TLS_CERTIFICATE_UNVERIFIED',503);
   return NextResponse.json({connected:true,database:row.database,role:row.role,
    leastPrivilege:{elevated:false,neonSuperuserMember:false,forbiddenWrite:false,canSelect:true},
    tls:{active:true,version:tlsVersion,certificateVerified:true,mode:'verify-full',scope:'client-to-neon',postgresBackendTlsReported:row.tls_active===true},
    neon:{branch:PREVIEW_NEON_BRANCH,endpoint:url.hostname,endpointMatched:true}},
    {headers:{'Cache-Control':'no-store'}});
  }finally{client.release();}
 }catch{return respond('TEST_DATABASE_UNAVAILABLE',503);}
 finally{await pool.end().catch(()=>{});}
}
