import {NextRequest,NextResponse} from 'next/server';
import {Pool} from 'pg';
import {createHash,timingSafeEqual} from 'node:crypto';
import {isIsolatedPreview} from '../../../../lib/test-worker-guards';
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
 if(!process.env.TIMEEASE_DB_DATABASE_URL)return respond('TEST_DATABASE_MISSING',503);
 const pool=new Pool({connectionString:process.env.TIMEEASE_DB_DATABASE_URL,max:1,connectionTimeoutMillis:4000});
 try{
  const result=await pool.query('SELECT current_database() AS database, current_user AS role');
  if(result.rows[0]?.role!=='timeease_test_worker')return respond('TEST_ROLE_MISMATCH',503);
  return NextResponse.json({connected:true,database:result.rows[0].database,role:result.rows[0].role},{headers:{'Cache-Control':'no-store'}});
 }catch{return respond('TEST_DATABASE_UNAVAILABLE',503)}
 finally{await pool.end().catch(()=>{});}
}
