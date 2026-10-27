-- REVIEWABLE FIXTURE ONLY. NOT a migration; never run during build.
-- Run only after an authorized Preview POST transport is available.
-- Neon Console: timeease-db > branch timeease-v2-launch-validation-20261017
-- (br-rough-butterfly-aox5mukp) > SQL Editor > neondb.
-- Use an existing authorized operator role, not the application/Worker role.
-- No CREATE ROLE, GRANT, password change, real payment or Shopify call.
BEGIN;
DO $$
BEGIN
 IF current_database() IS DISTINCT FROM 'neondb'
  OR current_setting('neon.project_id',true) IS DISTINCT FROM 'odd-base-63790740'
  OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-rough-butterfly-aox5mukp' THEN
  RAISE EXCEPTION 'PREVIEW_BRANCH_REQUIRED';
 END IF;
 INSERT INTO public.timeease_v2_orders
  (intake_id,shopify_order_id,shopify_shop_domain,variant_id,amount_usd,customer_email,source_manifest_path,status)
 SELECT id::uuid,'preview-e2e:'||kind||':'||id,'preview.invalid','synthetic-invoice',1,
  'jcaiworker@gmail.com','intake-v2/'||id||'/manifest.json','PAID'
 FROM (VALUES
  ('delivery','d7438959-82c2-4d9a-959c-b065ecc12720'),
  ('failure','5b6b7ad4-3ff3-409c-a584-d47c6d77ca97')
 ) AS fixtures(kind,id)
 ON CONFLICT DO NOTHING;
 IF (SELECT count(*) FROM public.timeease_v2_orders o
  JOIN (VALUES
   ('delivery','d7438959-82c2-4d9a-959c-b065ecc12720'),
   ('failure','5b6b7ad4-3ff3-409c-a584-d47c6d77ca97')
  ) AS f(kind,id) ON o.intake_id=f.id::uuid
  WHERE o.shopify_order_id='preview-e2e:'||f.kind||':'||f.id
   AND o.shopify_shop_domain='preview.invalid' AND o.variant_id='synthetic-invoice'
   AND o.amount_usd=1 AND o.customer_email='jcaiworker@gmail.com'
   AND o.source_manifest_path='intake-v2/'||f.id||'/manifest.json') <> 2 THEN
  RAISE EXCEPTION 'FIXTURE_COLLISION_NO_EXISTING_ROW_WAS_RESET';
 END IF;
END $$;
COMMIT;
-- PAID and amount_usd=1 are synthetic state-machine fixtures, not payment receipts.
-- Re-running never resets processing/delivered/reviewed rows or existing timestamps.
SELECT intake_id,status,processing_attempts FROM public.timeease_v2_orders
 WHERE intake_id IN ('d7438959-82c2-4d9a-959c-b065ecc12720'::uuid,
                    '5b6b7ad4-3ff3-409c-a584-d47c6d77ca97'::uuid);
