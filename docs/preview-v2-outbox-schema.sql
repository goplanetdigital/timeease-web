-- REVIEW / APPROVAL REQUIRED. Never auto-run from build, app startup or migrations.
-- Changes only the two EMPTY Preview tables' FK targets and scoped Worker grants.
-- No order, receipt, payment, role credential, Production or legacy-claim mutation.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='5s';
DO $scope$
BEGIN
 IF current_database() IS DISTINCT FROM 'neondb'
 OR current_setting('neon.project_id',true) IS DISTINCT FROM 'odd-base-63790740'
 OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-restless-hill-ao5vpgb4'
 OR current_user IS DISTINCT FROM 'neondb_owner'
 THEN RAISE EXCEPTION 'EXACT_PREVIEW_OPERATOR_REQUIRED'; END IF;
END $scope$;
LOCK TABLE public.timeease_fulfillment_outbox,public.timeease_delivery_ledger IN ACCESS EXCLUSIVE MODE;
DO $empty$
BEGIN
 IF EXISTS(SELECT 1 FROM public.timeease_fulfillment_outbox)
 OR EXISTS(SELECT 1 FROM public.timeease_delivery_ledger)
 OR EXISTS(SELECT 1 FROM public.timeease_paid_intake_claims)
 THEN RAISE EXCEPTION 'EMPTY_PREVIEW_TABLES_REQUIRED_NO_DATA_REWRITE'; END IF;
 IF (SELECT count(*) FROM pg_constraint
  WHERE conname IN ('timeease_fulfillment_outbox_intake_id_fkey','timeease_delivery_ledger_intake_id_fkey')
  AND conrelid IN ('public.timeease_fulfillment_outbox'::regclass,'public.timeease_delivery_ledger'::regclass)
  AND contype='f' AND confrelid='public.timeease_paid_intake_claims'::regclass)<>2
 THEN RAISE EXCEPTION 'EXPECTED_LEGACY_FK_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='timeease_worker_limited'
  AND rolcanlogin AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolreplication))
 OR pg_has_role('timeease_worker_limited','neon_superuser','MEMBER')
 THEN RAISE EXCEPTION 'EXISTING_LIMITED_WORKER_ROLE_REQUIRED'; END IF;
END $empty$;
ALTER TABLE public.timeease_fulfillment_outbox
 DROP CONSTRAINT timeease_fulfillment_outbox_intake_id_fkey,
 ADD CONSTRAINT timeease_fulfillment_outbox_intake_id_fkey
 FOREIGN KEY (intake_id) REFERENCES public.timeease_v2_orders(intake_id);
ALTER TABLE public.timeease_delivery_ledger
 DROP CONSTRAINT timeease_delivery_ledger_intake_id_fkey,
 ADD CONSTRAINT timeease_delivery_ledger_intake_id_fkey
 FOREIGN KEY (intake_id) REFERENCES public.timeease_v2_orders(intake_id);
GRANT SELECT,INSERT ON public.timeease_fulfillment_outbox,public.timeease_delivery_ledger TO timeease_worker_limited;
GRANT UPDATE(status,attempt_count,lease_until,updated_at) ON public.timeease_fulfillment_outbox TO timeease_worker_limited;
GRANT UPDATE(status,provider_message_id,attempt_number,updated_at) ON public.timeease_delivery_ledger TO timeease_worker_limited;
-- No DELETE/TRUNCATE, UPDATE of IDs/bindings, or INSERT on V2 orders is granted.
-- Primary keys, unique receipt/order/type constraints, CHECKs and rows are retained.
COMMIT;
-- Rollback before any new data: separately approved transaction restoring the two
-- legacy FKs and revoking exactly these new grants, only while both tables empty.
-- After new evidence rows exist: app rollback only, keep schema and audit data;
-- never DELETE records merely to make a down-migration possible.
