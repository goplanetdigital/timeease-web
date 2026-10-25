import {NextResponse} from 'next/server';
import {Pool} from 'pg';
import {isIsolatedPreview} from '../../../../lib/test-worker-guards';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 if(!isIsolatedPreview(process.env)) return NextResponse.json({error:'ISOLATION_REQUIRED'},{status:503});
 if(!process.env.TIMEEASE_DB_DATABASE_URL) return NextResponse.json({error:'TEST_DATABASE_MISSING'},{status:503});
 const pool=new Pool({connectionString:process.env.TIMEEASE_DB_DATABASE_URL,max:1,connectionTimeoutMillis:4000});
 try {
  const result=await pool.query('SELECT current_database() AS database, current_user AS role');
  if(result.rows[0]?.role!=='timeease_test_worker') return NextResponse.json({error:'TEST_ROLE_MISMATCH'},{status:503});
  return NextResponse.json({connected:true,database:result.rows[0].database,role:result.rows[0].role});
 } catch {return NextResponse.json({error:'TEST_DATABASE_UNAVAILABLE'},{status:503});}
 finally {await pool.end().catch(()=>{});}
}
