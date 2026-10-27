-- Replaces the failed legacy-role REVOKE approach.
-- Operator-run on the exact isolated Preview branch only.
-- No password, no login, no existing role modification, no order mutation.
-- This is one atomic creation/permission statement followed by read-only evidence.
DO $guard$
BEGIN
  IF current_setting('neon.project_id', true)
       IS DISTINCT FROM 'odd-base-63790740'
     OR current_setting('neon.branch_id', true)
       IS DISTINCT FROM 'br-rough-butterfly-aox5mukp'
     OR current_database() <> 'neondb' THEN
    RAISE EXCEPTION 'STOP: Preview identity mismatch';
  END IF;
  IF current_setting('transaction_read_only') <> 'off' THEN
    RAISE EXCEPTION 'STOP: read-only connection';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles
             WHERE rolname = 'timeease_worker_limited') THEN
    RAISE EXCEPTION 'STOP: role already exists; inspect it before continuing';
  END IF;

  CREATE ROLE timeease_worker_limited
    NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
    NOINHERIT NOREPLICATION NOBYPASSRLS;

  GRANT CONNECT ON DATABASE neondb TO timeease_worker_limited;
  GRANT USAGE ON SCHEMA public TO timeease_worker_limited;
  GRANT SELECT ON public.timeease_v2_orders
    TO timeease_worker_limited;
  GRANT UPDATE (
    status, processing_started_at, processing_attempts,
    result_path, delivery_message_id, delivered_at, last_error
  ) ON public.timeease_v2_orders TO timeease_worker_limited;

  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'timeease_worker_limited'
      AND (rolsuper OR rolcreatedb OR rolcreaterole
           OR rolbypassrls OR rolreplication OR rolcanlogin)
  ) OR pg_has_role(
    'timeease_worker_limited', 'neon_superuser', 'MEMBER'
  ) THEN
    RAISE EXCEPTION 'STOP: unexpected role attributes';
  END IF;
END
$guard$;

SELECT
  rolname, rolcanlogin, rolcreatedb, rolcreaterole,
  rolbypassrls, rolreplication,
  pg_has_role(rolname, 'neon_superuser', 'MEMBER')
    AS neon_superuser_member,
  has_table_privilege(rolname, 'public.timeease_v2_orders', 'SELECT')
    AS can_select_orders,
  has_table_privilege(rolname, 'public.timeease_v2_orders', 'INSERT')
    AS can_insert_orders,
  has_table_privilege(rolname, 'public.timeease_v2_orders', 'DELETE')
    AS can_delete_orders
FROM pg_roles
WHERE rolname = 'timeease_worker_limited';
