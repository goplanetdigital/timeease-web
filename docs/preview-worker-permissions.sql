-- Review-only operator script; NOT applied by this task.
-- Execute only on the named Preview branch with an authorized write-capable admin.
-- One atomic statement. On failure, inspect error/transaction state before retrying.
DO $guard$
BEGIN
 IF current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-rough-butterfly-aox5mukp' OR current_setting('neon.project_id',true) IS DISTINCT FROM 'odd-base-63790740' THEN RAISE EXCEPTION 'Preview identity mismatch'; END IF;
 IF EXISTS (SELECT 1 FROM pg_class WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname='timeease_test_worker')) OR EXISTS (SELECT 1 FROM pg_database WHERE datdba=(SELECT oid FROM pg_roles WHERE rolname='timeease_test_worker')) THEN RAISE EXCEPTION 'Worker owns objects; manual review required'; END IF;
 REVOKE neon_superuser FROM timeease_test_worker;
 ALTER ROLE timeease_test_worker NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
 REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM timeease_test_worker;
 REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM timeease_test_worker;
 REVOKE ALL PRIVILEGES ON SCHEMA public FROM timeease_test_worker;
 GRANT USAGE ON SCHEMA public TO timeease_test_worker;
 GRANT CONNECT ON DATABASE neondb TO timeease_test_worker;
 GRANT SELECT ON public.timeease_v2_orders TO timeease_test_worker;
 GRANT UPDATE (status,processing_started_at,processing_attempts,result_path,delivery_message_id,delivered_at,last_error) ON public.timeease_v2_orders TO timeease_test_worker;
END $guard$;

