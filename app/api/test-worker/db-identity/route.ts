import {NextRequest,NextResponse} from 'next/server';
import {Pool} from 'pg';
import {createHash,timingSafeEqual} from 'node:crypto';
import {isIsolatedPreview} from '../../../../lib/test-worker-guards';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const EXPECTED_HOST='ep-summer-salad-aoeax66z.c-2.ap-southeast-1.aws.neon.tech';
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
 if(url.hostname!==EXPECTED_HOST)return respond('TEST_ENDPOINT_MISMATCH',503);
 if(url.username!=='timeease_test_worker'||url.pathname!=='/neondb')return respond('TEST_CONNECTION_IDENTITY_MISMATCH',503);
 url.searchParams.set('sslmode','verify-full');
 const pool=new Pool({connectionString:url.toString(),max:1,connectionTimeoutMillis:4000});
 try{
  const client=await pool.connect();
  try{
   const result=await client.query(`SELECT current_database() AS database,current_user AS role,
     (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls_active,
     (SELECT version FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls_version`);
   const row=result.rows[0];
   if(row?.role!=='timeease_test_worker'||row?.database!=='neondb')return respond('TEST_ROLE_MISMATCH',503);
   if(row?.tls_active!==true)return respond('TEST_TLS_REQUIRED',503);
   const stream=client.connection.stream as unknown as {authorized?:boolean};
   if(stream.authorized!==true)return respond('TEST_TLS_CERTIFICATE_UNVERIFIED',503);
   return NextResponse.json({connected:true,database:row.database,role:row.role,
    tls:{active:true,version:row.tls_version,certificateVerified:true,mode:'verify-full'},
    neon:{branch:'br-rough-butterfly-aox5mukp',endpoint:EXPECTED_HOST,endpointMatched:true}},
    {headers:{'Cache-Control':'no-store'}});
  }finally{client.release();}
 }catch{return respond('TEST_DATABASE_UNAVAILABLE',503);}
 finally{await pool.end().catch(()=>{});}
}
