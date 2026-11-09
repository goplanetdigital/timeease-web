-- PROPOSAL ONLY: independent Production approval is required. Never auto-run.
-- No order DML, passwords, LOGIN activation, cleanup or down-migration.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='5s';
DO $scope$
BEGIN
 IF current_database() IS DISTINCT FROM 'neondb'
 OR current_setting('neon.project_id',true) IS DISTINCT FROM 'odd-base-63790740'
 OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-wispy-river-aoo9eown'
 OR current_user IS DISTINCT FROM 'neondb_owner' THEN RAISE EXCEPTION 'EXACT_PRODUCTION_OPERATOR_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('timeease_worker_limited','timeease_payment_limited'))
 THEN RAISE EXCEPTION 'EXISTING_ROLES_REQUIRE_NEW_REVIEW'; END IF;
END $scope$;
LOCK TABLE public.timeease_fulfillment_outbox,public.timeease_delivery_ledger,public.timeease_paid_intake_claims IN ACCESS EXCLUSIVE MODE;
DO $empty$
BEGIN
 IF EXISTS(SELECT 1 FROM public.timeease_fulfillment_outbox) OR EXISTS(SELECT 1 FROM public.timeease_delivery_ledger)
 OR EXISTS(SELECT 1 FROM public.timeease_paid_intake_claims) THEN RAISE EXCEPTION 'EMPTY_LEGACY_DELIVERY_TABLES_REQUIRED'; END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE conrelid IN ('public.timeease_fulfillment_outbox'::regclass,'public.timeease_delivery_ledger'::regclass)
 AND conname IN ('timeease_fulfillment_outbox_intake_id_fkey','timeease_delivery_ledger_intake_id_fkey')
 AND contype='f' AND confrelid='public.timeease_paid_intake_claims'::regclass)<>2
 THEN RAISE EXCEPTION 'EXPECTED_LEGACY_FKS_REQUIRED'; END IF;
END $empty$;
ALTER TABLE public.timeease_fulfillment_outbox DROP CONSTRAINT timeease_fulfillment_outbox_intake_id_fkey,
 ADD CONSTRAINT timeease_fulfillment_outbox_intake_id_fkey FOREIGN KEY(intake_id) REFERENCES public.timeease_v2_orders(intake_id);
ALTER TABLE public.timeease_delivery_ledger DROP CONSTRAINT timeease_delivery_ledger_intake_id_fkey,
 ADD CONSTRAINT timeease_delivery_ledger_intake_id_fkey FOREIGN KEY(intake_id) REFERENCES public.timeease_v2_orders(intake_id);
CREATE TABLE public.timeease_payment_holds (
 shop_domain text NOT NULL CHECK(shop_domain ~ '^[a-z0-9][a-z0-9-]*[.]myshopify[.]com$'),
 shopify_order_id text NOT NULL CHECK(shopify_order_id ~ '^[1-9][0-9]*$'),
 reason text NOT NULL CHECK(reason IN ('CANCELLED','REFUNDED')),
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(shop_domain,shopify_order_id)
);
CREATE ROLE timeease_worker_limited NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE timeease_payment_limited NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT CONNECT ON DATABASE neondb TO timeease_worker_limited,timeease_payment_limited;
GRANT USAGE ON SCHEMA public TO timeease_worker_limited,timeease_payment_limited;
GRANT SELECT ON public.timeease_v2_orders,public.timeease_fulfillment_outbox,public.timeease_delivery_ledger,public.timeease_payment_holds
 TO timeease_worker_limited,timeease_payment_limited;
GRANT INSERT ON public.timeease_fulfillment_outbox,public.timeease_delivery_ledger TO timeease_worker_limited;
GRANT UPDATE(status,processing_started_at,processing_attempts,result_path,delivery_message_id,delivered_at,last_error)
 ON public.timeease_v2_orders TO timeease_worker_limited;
GRANT UPDATE(status,attempt_count,lease_until,updated_at) ON public.timeease_fulfillment_outbox TO timeease_worker_limited;
GRANT UPDATE(status,provider_message_id,attempt_number,updated_at) ON public.timeease_delivery_ledger TO timeease_worker_limited;
GRANT INSERT ON public.timeease_v2_orders,public.timeease_payment_holds TO timeease_payment_limited;
GRANT UPDATE(status,last_error) ON public.timeease_v2_orders TO timeease_payment_limited;
GRANT UPDATE(status,lease_until,updated_at) ON public.timeease_fulfillment_outbox TO timeease_payment_limited;
GRANT UPDATE(status,updated_at) ON public.timeease_delivery_ledger TO timeease_payment_limited;
COMMIT;
-- Any error before COMMIT rolls back FKs/table/roles/grants together.
-- Preserve all existing V2 orders, primary/unique constraints and receipts.
-- Operator must separately provision the two limited logins and purpose-specific
-- secrets using Neon/Vercel secure configuration. No password belongs in SQL/Git.
-- Before data: a separately reviewed reverse transaction may restore FKs/grants.
-- After any hold, Outbox or receipt: retain schema/audit; freeze sends and drain.
