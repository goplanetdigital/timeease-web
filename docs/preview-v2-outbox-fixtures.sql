-- REVIEW / APPROVAL REQUIRED, after schema readiness and exact Preview transport.
-- One INSERT, three fresh synthetic rows. Never reset any of the five old fixtures.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='5s';
DO $fixtures$
BEGIN
 IF current_database() IS DISTINCT FROM 'neondb'
 OR current_setting('neon.project_id',true) IS DISTINCT FROM 'odd-base-63790740'
 OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-restless-hill-ao5vpgb4'
 OR current_user IS DISTINCT FROM 'neondb_owner'
 THEN RAISE EXCEPTION 'EXACT_PREVIEW_OPERATOR_REQUIRED'; END IF;
 IF (SELECT count(*) FROM pg_constraint
  WHERE conname IN ('timeease_fulfillment_outbox_intake_id_fkey','timeease_delivery_ledger_intake_id_fkey')
  AND contype='f' AND convalidated AND confrelid='public.timeease_v2_orders'::regclass)<>2
 THEN RAISE EXCEPTION 'V2_OUTBOX_SCHEMA_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM public.timeease_v2_orders
  WHERE intake_id IN ('b8f0b839-e0ff-4ef5-bf90-c32513c83fbf'::uuid,
   '712fb48a-03e8-470f-82fe-e8a5dbe12b7e'::uuid,
   '52c899ce-3ea0-4d03-b9df-7e5ae2d83d99'::uuid)
  OR shopify_order_id LIKE 'preview-pr20-outbox-20261107:%')
 THEN RAISE EXCEPTION 'FIXTURE_COLLISION_NO_RESET'; END IF;
 INSERT INTO public.timeease_v2_orders
 (intake_id,shopify_order_id,shopify_shop_domain,variant_id,amount_usd,
 customer_email,source_manifest_path,status,processing_attempts)
 SELECT id::uuid,'preview-pr20-outbox-20261107:'||kind||':'||id,
 'preview.invalid','synthetic-invoice',1,'jcaiworker@gmail.com',
 'intake-v2/'||id||'/manifest.json','PAID',0
 FROM (VALUES
 ('outbox_persist','b8f0b839-e0ff-4ef5-bf90-c32513c83fbf'),
 ('outbox_failure','712fb48a-03e8-470f-82fe-e8a5dbe12b7e'),
 ('outbox_timeout','52c899ce-3ea0-4d03-b9df-7e5ae2d83d99')
 ) f(kind,id);
END $fixtures$;
COMMIT;
-- Synthetic PAID/USD1 is a state-machine fixture, never a real payment/revenue.
-- Do not seed Outbox or Ledger here: the actual result publisher must create them.
