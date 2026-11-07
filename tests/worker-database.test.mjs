import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
import pg from 'pg';

const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const worker={};
vm.runInNewContext(compile('lib/worker-database.ts'),{exports:worker,process:{env:{}},URL,Error});
const base='postgresql://timeease_worker_limited@example.invalid/neondb';
const preview=raw=>({VERCEL_ENV:'preview',TIMEEASE_WORKER_DATABASE_URL:raw});
const missing=error=>error.message==='WORKER_DATABASE_PASSWORD_MISSING';

test('Preview rejects missing and empty passwords before pg can fall back to null',()=>{
 const prior=process.env.PGPASSWORD;
 delete process.env.PGPASSWORD;
 try{
  // Real pg parsing, without connecting: this was the SCRAM failure path.
  assert.equal(new pg.Client({connectionString:base}).password,null);
  for(const raw of [base,base.replace('@',':@'),base+'?password=']){
   assert.throws(()=>worker.workerDatabaseConnection(preview(raw)),missing);
  }
 }finally{
  if(prior===undefined)delete process.env.PGPASSWORD;else process.env.PGPASSWORD=prior;
 }
});

test('Preview does not use ambient PG password or fall back from an invalid dedicated URL',()=>{
 const prior=process.env.PGPASSWORD;
 process.env.PGPASSWORD='synthetic-ambient-must-not-be-used';
 try{
  assert.throws(()=>worker.workerDatabaseConnection({
   ...preview(base),TIMEEASE_DB_DATABASE_URL:base.replace('@',':synthetic-ledger-password@')
  }),missing);
 }finally{
  if(prior===undefined)delete process.env.PGPASSWORD;else process.env.PGPASSWORD=prior;
 }
});

test('valid Preview passwords reach real Pool client configuration as strings without changing TLS',async()=>{
 for(const raw of [base.replace('@',':synthetic%40p%3Ass%2Fword@')+'?sslmode=verify-full',
  base+'?password=synthetic%40query&sslmode=verify-full']){
  const connectionString=worker.workerDatabaseConnection(preview(raw));
  assert.equal(connectionString,raw);
  const pool=new pg.Pool({connectionString,max:3,connectionTimeoutMillis:5000});
  try{
   const client=new pg.Client(pool.options); // No socket, query, order or email.
   assert.equal(typeof client.password,'string');assert.ok(client.password.length>0);
   assert.notEqual(client.connectionParameters.ssl,false);
   assert.notEqual(client.connectionParameters.ssl?.rejectUnauthorized,false);
   assert.equal(client.user,'timeease_worker_limited');
   assert.equal(pool.options.connectionTimeoutMillis,5000);
  }finally{await pool.end();}
 }
});

test('Preview honors pg password query precedence and percent decoding without returning credentials in errors',()=>{
 const raw=base.replace('@',':synthetic-userinfo@')+'?password=synthetic%40override';
 const client=new pg.Client({connectionString:worker.workerDatabaseConnection(preview(raw))});
 assert.equal(client.password,'synthetic@override');
 assert.throws(()=>worker.workerDatabaseConnection(preview(base.replace('@',':%ZZ@'))),missing);
});

test('limited-role guard and Production connection selection stay unchanged',()=>{
 const owner=base.replace('timeease_worker_limited','neondb_owner');
 assert.throws(()=>worker.workerDatabaseConnection(preview(owner)),
  error=>error.message==='WORKER_DATABASE_ROLE_FORBIDDEN');
 assert.equal(worker.workerDatabaseConnection({VERCEL_ENV:'production',TIMEEASE_WORKER_DATABASE_URL:base}),base);
 const raw=base.replace('@',':synthetic-fallback@');
 assert.equal(worker.workerDatabaseConnection({VERCEL_ENV:'preview',TIMEEASE_DB_DATABASE_URL:raw}),raw);
});

test('formal Preview pending closes before constructing Pool',async()=>{
 let pools=0;const logs=[];const route={};
 const secret='synthetic-worker-secret-for-local-test-only';
 const env={...preview(base),TIMEEASE_V2_WORKER_SECRET:secret,TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'true'};
 vm.runInNewContext(compile('app/api/worker/pending/route.ts'),{
  exports:route,process:{env},URL,Error,console:{error:(...args)=>logs.push(args)},
  require:name=>name==='node:crypto'?crypto:name==='pg'?{Pool:class{constructor(){pools++;throw Error('Pool forbidden');}}}:
   name==='next/server'?{NextResponse:{json:(data,options)=>({data,...options})}}:
   name.includes('production-release')?{productionReleaseBound:()=>false,acceptingProductionWork:()=>false}:name.includes('production-database')?{}:{workerDatabaseConnection:()=>worker.workerDatabaseConnection(env)}
 });
 const result=await route.GET({url:'https://preview.example.invalid/api/worker/pending',
  headers:new Map([['authorization',`Bearer ${secret}`]])});
 assert.equal(result.status,503);
 assert.deepEqual(result.data.error,'PRODUCTION_RELEASE_CLOSED');
 assert.equal(pools,0);assert.deepEqual(logs,[]);
 assert.equal(JSON.stringify(result).includes(base),false);
 assert.equal(JSON.stringify(result).includes(secret),false);
});
