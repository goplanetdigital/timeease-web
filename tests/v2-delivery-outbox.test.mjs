import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';

// Actual PostgreSQL queries/transactions; no SQL state-machine mocks. PGlite is
// single-backend, so this suite does NOT claim multi-session concurrency or Neon.
const compile=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const shared={};vm.runInNewContext(compile('lib/paid-job-claim.ts'),{exports:shared,require:()=>({Pool:class{constructor(){throw Error('AMBIENT_POOL_FORBIDDEN');}}})});
const api={};vm.runInNewContext(compile('lib/v2-delivery-outbox.ts'),{exports:api,require:n=>{
 assert.ok(n.endsWith('paid-job-claim'));return shared;
}});
const schema=readFileSync('tests/fixtures/v2-outbox-schema.sql','utf8');
const client=q=>({query:async(sql,args)=>{const r=await q.query(sql,args);return {...r,rowCount:r.rowCount??r.affectedRows??r.rows.length};}});
const run=(db,fn)=>db.transaction(tx=>fn(client(tx)));
async function database(){const db=new PGlite();await db.exec(schema);return db;}
async function seed(db,id=randomUUID()){
 await db.query(`INSERT INTO public.timeease_v2_orders(intake_id,shopify_order_id,shopify_shop_domain,variant_id,amount_usd,
 customer_email,source_manifest_path,status,processing_attempts,processing_started_at)
 VALUES($1,$2,'preview.invalid','synthetic-invoice',1,'jcaiworker@gmail.com',$3,'PROCESSING',1,now())`,
 [id,'local-synthetic:'+id,`intake-v2/${id}/manifest.json`]);return id;
}
const publish=(db,id,deliveryId=randomUUID())=>run(db,c=>api.publishV2Result(id,`results-v2/${id}/consolidated.xlsx`,deliveryId,c));
async function snapshot(db,id){return (await db.query(`SELECT to_jsonb(o) AS order_row,
 (SELECT to_jsonb(x) FROM public.timeease_fulfillment_outbox x WHERE x.intake_id=o.intake_id) AS outbox,
 (SELECT to_jsonb(l) FROM public.timeease_delivery_ledger l WHERE l.intake_id=o.intake_id) AS ledger
 FROM public.timeease_v2_orders o WHERE o.intake_id=$1`,[id])).rows[0];}

test('Outbox result, queue and ledger persist together after PostgreSQL close/reopen',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'timeease-outbox-'));let db;
 try{
  db=new PGlite(dir);await db.exec(schema);const id=await seed(db),deliveryId=randomUUID();
  assert.equal(await publish(db,id,deliveryId),'ENQUEUED');await db.close();db=new PGlite(dir);
  const x=await snapshot(db,id);assert.equal(x.order_row.result_path,`results-v2/${id}/consolidated.xlsx`);
  assert.equal(x.outbox.status,'PENDING');assert.equal(x.ledger.status,'PENDING');assert.equal(x.ledger.delivery_id,deliveryId);
  assert.equal(x.outbox.attempt_count,0);assert.equal(x.ledger.provider_message_id,null);
 }finally{if(db&&!db.closed)await db.close();rmSync(dir,{recursive:true,force:true});}
});
test('Outbox ledger-insert failure rolls back result and queue writes atomically',async()=>{
 const db=await database();try{
  const id=await seed(db);
  await db.exec(`CREATE FUNCTION reject_local_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'LOCAL_INJECTED_LEDGER_FAILURE'; END $$;
   CREATE TRIGGER reject_ledger BEFORE INSERT ON public.timeease_delivery_ledger FOR EACH ROW EXECUTE FUNCTION reject_local_ledger();`);
  await assert.rejects(publish(db,id),/LOCAL_INJECTED_LEDGER_FAILURE/);
  const x=await snapshot(db,id);assert.equal(x.order_row.result_path,null);assert.equal(x.outbox,null);assert.equal(x.ledger,null);
 }finally{await db.close();}
});
test('Outbox enqueue replay retains one queue row, one ledger row and original immutable ID',async()=>{
 const db=await database();try{
  const id=await seed(db),deliveryId=randomUUID();await publish(db,id,deliveryId);const before=await snapshot(db,id);
  assert.equal(await publish(db,id,randomUUID()),'IDEMPOTENT');assert.deepEqual(await snapshot(db,id),before);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.timeease_fulfillment_outbox')).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.timeease_delivery_ledger')).rows[0].n,1);
  await db.query('UPDATE public.timeease_fulfillment_outbox SET shopify_order_id=$2 WHERE intake_id=$1',[id,'wrong-binding']);
  await assert.rejects(publish(db,id),/OUTBOX_LEDGER_BINDING_CONFLICT/);
 }finally{await db.close();}
});
test('Outbox duplicate lease never increments attempts or grants another send',async()=>{
 const db=await database();try{
  const id=await seed(db);await publish(db,id);
  assert.equal(await run(db,c=>api.claimV2Outbox(id,c)),'CLAIMED');const before=await snapshot(db,id);
  assert.equal(before.outbox.status,'PROCESSING');assert.equal(before.ledger.status,'SENDING');
  assert.equal(before.outbox.attempt_count,1);assert.equal(before.ledger.attempt_number,1);
  assert.equal(await run(db,c=>api.claimV2Outbox(id,c)),'IN_FLIGHT');assert.deepEqual(await snapshot(db,id),before);
 }finally{await db.close();}
});
test('Outbox known no-send failure atomically quarantines all three states without retry',async()=>{
 const db=await database();try{
  const id=await seed(db);await publish(db,id);await run(db,c=>api.claimV2Outbox(id,c));
  assert.equal(await run(db,c=>api.failV2OutboxBeforeSend(id,c)),true);
  const x=await snapshot(db,id);assert.equal(x.order_row.status,'REVIEW_REQUIRED');assert.equal(x.outbox.status,'FAILED');
  assert.equal(x.ledger.status,'FAILED');assert.equal(x.ledger.provider_message_id,null);
  assert.equal(await run(db,c=>api.claimV2Outbox(id,c)),'NOT_CLAIMABLE');
  assert.equal(await run(db,c=>api.failV2OutboxBeforeSend(id,c)),false);assert.deepEqual(await snapshot(db,id),x);
 }finally{await db.close();}
});
test('Outbox unexpired lease rejects recovery; expired local SQL fixture becomes UNKNOWN without resend',async()=>{
 const db=await database();try{
  const id=await seed(db);await publish(db,id);await run(db,c=>api.claimV2Outbox(id,c));
  assert.equal(await run(db,c=>api.recoverV2Outbox(id,c)),false);
  // Local-only expired-state fixture. No Neon clock/lease changes; not a real-time acceptance claim.
  await db.query("UPDATE public.timeease_fulfillment_outbox SET lease_until=now()-interval '1 second' WHERE intake_id=$1",[id]);
  assert.equal(await run(db,c=>api.recoverV2Outbox(id,c)),true);const x=await snapshot(db,id);
  assert.equal(x.ledger.status,'UNKNOWN');assert.equal(x.outbox.status,'FAILED');assert.equal(x.order_row.status,'REVIEW_REQUIRED');
  assert.equal(x.order_row.delivery_message_id,null);assert.equal(x.outbox.attempt_count,1);
  assert.equal(await run(db,c=>api.claimV2Outbox(id,c)),'NOT_CLAIMABLE');
  assert.equal(await run(db,c=>api.recoverV2Outbox(id,c)),false);assert.deepEqual(await snapshot(db,id),x);
 }finally{await db.close();}
});
test('Outbox trusted receipt completion is atomic and exact-receipt idempotent in local PostgreSQL only',async()=>{
 const db=await database();try{
  const id=await seed(db);await publish(db,id);await run(db,c=>api.claimV2Outbox(id,c));
  const syntheticLocalReceipt='abcdef0123456789';
  assert.equal(await run(db,c=>api.completeV2Outbox(id,syntheticLocalReceipt,c)),'DELIVERED');
  const x=await snapshot(db,id);assert.equal(x.order_row.status,'DELIVERED');assert.equal(x.outbox.status,'DELIVERED');assert.equal(x.ledger.status,'SENT');
  assert.equal(await run(db,c=>api.completeV2Outbox(id,syntheticLocalReceipt,c)),'IDEMPOTENT');
  assert.equal(await run(db,c=>api.completeV2Outbox(id,'fedcba9876543210',c)),'REJECTED');assert.deepEqual(await snapshot(db,id),x);
  const second=await seed(db);await publish(db,second);await run(db,c=>api.claimV2Outbox(second,c));const before=await snapshot(db,second);
  await assert.rejects(run(db,c=>api.completeV2Outbox(second,syntheticLocalReceipt,c)),/OUTBOX_RECEIPT_CONFLICT/);
  assert.deepEqual(await snapshot(db,second),before);
 }finally{await db.close();}
});
test('Outbox schema guard rejects legacy FKs and requires precise non-destructive Worker grants',async()=>{
 const db=await database();try{
  await assert.rejects(api.requireV2OutboxSchema(client(db)),/OUTBOX_ROLE_NOT_READY/); // owner is too broad
  await db.exec(`CREATE ROLE timeease_worker_limited;
   GRANT SELECT,INSERT ON public.timeease_fulfillment_outbox,public.timeease_delivery_ledger TO timeease_worker_limited;
   GRANT UPDATE(status,attempt_count,lease_until,updated_at) ON public.timeease_fulfillment_outbox TO timeease_worker_limited;
   GRANT UPDATE(status,provider_message_id,attempt_number,updated_at) ON public.timeease_delivery_ledger TO timeease_worker_limited;
   SET ROLE timeease_worker_limited;`);
  await api.requireV2OutboxSchema(client(db));await db.exec('RESET ROLE;');
  await db.exec(`ALTER TABLE public.timeease_delivery_ledger DROP CONSTRAINT timeease_delivery_ledger_provider_message_id_key;
   SET ROLE timeease_worker_limited;`);
  await assert.rejects(api.requireV2OutboxSchema(client(db)),/OUTBOX_SCHEMA_NOT_READY/);await db.exec('RESET ROLE;');
  await db.exec('ALTER TABLE public.timeease_delivery_ledger ADD CONSTRAINT timeease_delivery_ledger_provider_message_id_key UNIQUE(provider_message_id);');
  await db.exec(`ALTER TABLE public.timeease_fulfillment_outbox DROP CONSTRAINT timeease_fulfillment_outbox_intake_id_fkey,
   ADD CONSTRAINT timeease_fulfillment_outbox_intake_id_fkey FOREIGN KEY(intake_id) REFERENCES public.timeease_paid_intake_claims(intake_id);
   SET ROLE timeease_worker_limited;`);
  await assert.rejects(api.requireV2OutboxSchema(client(db)),/OUTBOX_SCHEMA_NOT_READY/);await db.exec('RESET ROLE;');
 }finally{await db.close();}
});
