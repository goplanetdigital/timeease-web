import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';

const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const webhookSecret='synthetic-shopify-webhook-secret-32chars';
const bindingSecret='timeease-test-secret-not-for-production-123456789';
const shop='example.myshopify.com';
const intakeId='123e4567-e89b-42d3-a456-426614174000';
function load(path,require,env={}){
 const exports={};
 vm.runInNewContext(compile(path),{exports,require,process:{env},Buffer,URL,console});
 return exports;
}
const binding=load('lib/checkout-binding.ts',name=>name.includes('crypto')?crypto:{});
const paidOrder=load('lib/shopify-order-verification.ts',()=>{throw new Error('unexpected dependency');});
const bound=load('lib/shopify-bound-order.ts',name=>name.includes('checkout-binding')?binding:name.includes('shopify-order-verification')?paidOrder:(()=>{throw new Error(name);})());
const token=binding.signCheckoutToken({intakeId,variantId:'51393328480503',amountUsd:1,expiresAt:Math.floor(Date.now()/1000)+600},bindingSecret);

function harness(){
 const rows=[],queries=[];
 let pools=0;
 class Pool{
  constructor(){pools++;}
  async query(sql,args){
   queries.push(sql);
   if(sql.startsWith('INSERT')){
    if(rows.some(row=>row.intake_id===args[0]||row.shopify_order_id===args[1]))return {rowCount:0,rows:[]};
    const row={intake_id:args[0],shopify_order_id:args[1],shopify_shop_domain:args[2],variant_id:args[3],amount_usd:args[4],source_manifest_path:args[6]};
    rows.push(row);
    return {rowCount:1,rows:[{intake_id:row.intake_id}]};
   }
   const found=rows.filter(row=>row.intake_id===args[0]||row.shopify_order_id===args[1]);
   return {rowCount:found.length,rows:found};
  }
 }
 const env={VERCEL_ENV:'development',SHOPIFY_WEBHOOK_SECRET:webhookSecret,TIMEEASE_CHECKOUT_BINDING_SECRET:bindingSecret,SHOPIFY_SHOP_DOMAIN:shop,TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'true',TIMEEASE_DB_DATABASE_URL:'postgresql://timeease_ledger_writer:synthetic@example.internal/neondb'};
 let intakeReads=0;
 const route=load('app/api/webhooks/shopify/route.ts',name=>{
  if(name==='pg')return {Pool};
  if(name.includes('crypto'))return crypto;
  if(name==='next/server')return {NextResponse:{json:(data,options={})=>({data,status:options.status||200,headers:options.headers})}};
  if(name.includes('preview-blob-guard'))return {previewBlobAccessBlocked:()=>false};
  if(name.includes('blob-access'))return {blobAccessConfigured:()=>true,blobAccessOptions:async()=>({token:'synthetic-blob'})};
  if(name.includes('shopify-bound-order'))return bound;
  if(name.includes('verify-stored-intake'))return {verifyStoredIntake:async()=>{intakeReads++;return true;}};
  if(name.includes('paid-order-ledger'))return load('lib/paid-order-ledger.ts',dep=>dep==='pg'?{Pool}:(()=>{throw new Error(dep);})(),env);
  throw new Error(name);
 },env);
 return {route,rows,queries,get pools(){return pools;},get intakeReads(){return intakeReads;}};
}
function request(raw,signature,headers={}){
 const bytes=Buffer.from(raw);
 return {headers:{get:name=>({ 'content-length':String(bytes.length),'x-shopify-hmac-sha256':signature,'x-shopify-shop-domain':shop,'x-shopify-topic':'orders/paid',...headers }[name.toLowerCase()]??null)},
  body:{getReader(){let sent=false;return {async read(){if(sent)return {done:true};sent=true;return {done:false,value:bytes};},async cancel(){}};}}};
}
const order=(id=12345,price='1.00',status='paid')=>JSON.stringify({id,financial_status:status,currency:'USD',total_price:price,email:'synthetic@example.com',line_items:[{variant_id:51393328480503,quantity:1}],note_attributes:[{name:'_timeease_checkout_binding',value:token}]});
const sign=raw=>createHmac('sha256',webhookSecret).update(raw).digest('base64');

test('synthetic paid webhook verifies signature and binding, then records one replay as the same order',async()=>{
 const app=harness();
 const raw=order();
 const first=await app.route.POST(request(raw,sign(raw)));
 const second=await app.route.POST(request(raw,sign(raw)));
 assert.equal(first.status,200);assert.equal(first.data.status,'CREATED');assert.equal(first.data.delivery,'PENDING');
 assert.equal(second.status,200);assert.equal(second.data.status,'ALREADY_RECORDED');
 assert.equal(app.rows.length,1);assert.equal(app.pools,1);assert.equal(app.intakeReads,2);
});
test('invalid signature, unpaid status and tampered amount stop before any database connection',async()=>{
 const app=harness();
 const raw=order();
 const bad=await app.route.POST(request(raw,sign('{"id":1}')));
 const unpaid=await app.route.POST(request(order(12345,'1.00','pending'),sign(order(12345,'1.00','pending'))));
 const tampered=order(12345,'9.00');
 const wrongAmount=await app.route.POST(request(tampered,sign(tampered)));
 assert.equal(bad.status,401);assert.equal(unpaid.status,422);assert.equal(wrongAmount.status,422);
 assert.equal(app.pools,0);assert.equal(app.rows.length,0);assert.equal(app.intakeReads,0);
});
test('a second paid event for the same intake cannot bind another Shopify order',async()=>{
 const app=harness();
 const first=order(12345);
 await app.route.POST(request(first,sign(first)));
 const other=order(67890);
 const conflict=await app.route.POST(request(other,sign(other)));
 assert.equal(conflict.status,503);assert.equal(conflict.data.error,'PAID_ORDER_LEDGER_UNAVAILABLE');
 assert.equal(app.rows.length,1);assert.equal(app.rows[0].shopify_order_id,'12345');
});
test('worker database connections reject administrator roles before opening a pool',async()=>{
 const role=load('lib/worker-database.ts',()=>{throw new Error('worker role check has no dependencies');});
 const limited='postgresql://timeease_worker_limited:synthetic@example.internal/neondb';
 const owner='postgresql://neondb_owner:synthetic@example.internal/neondb';
 assert.equal(role.workerDatabaseConnection({TIMEEASE_DB_DATABASE_URL:limited}),limited);
 assert.equal(role.workerDatabaseConnection({TIMEEASE_DB_DATABASE_URL:owner,TIMEEASE_WORKER_DATABASE_URL:limited}),limited);
 assert.throws(()=>role.workerDatabaseConnection({TIMEEASE_DB_DATABASE_URL:owner}),/WORKER_DATABASE_ROLE_FORBIDDEN/);
 assert.throws(()=>role.workerDatabaseConnection({TIMEEASE_DB_DATABASE_URL:'postgresql://postgres:synthetic@example.internal/neondb'}),/WORKER_DATABASE_ROLE_FORBIDDEN/);
 let pools=0;
 const secret='synthetic-worker-test-value-with-32-characters';
 const env={TIMEEASE_V2_WORKER_SECRET:secret,TIMEEASE_V2_PAYMENT_LEDGER_ENABLED:'true',TIMEEASE_DB_DATABASE_URL:owner};
 const pending=load('app/api/worker/pending/route.ts',name=>{
  if(name==='pg')return {Pool:class{constructor(){pools++;}}};
  if(name.includes('crypto'))return crypto;
  if(name==='next/server')return {NextResponse:{json:(data,options={})=>({data,status:options.status||200})}};
  if(name.includes('worker-database'))return role;
  throw new Error(name);
 },env);
 const result=await pending.GET({url:'https://example.test/api/worker/pending',headers:{get:name=>name.toLowerCase()==='authorization'?`Bearer ${secret}`:null}});
 assert.equal(result.status,503);assert.equal(result.data.error,'WORKER_DATABASE_ROLE_FORBIDDEN');assert.equal(pools,0);
});
