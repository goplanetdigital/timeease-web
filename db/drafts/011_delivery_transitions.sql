-- Draft only. Requires 001_paid_intake_claims.sql and 009_delivery_ledger.sql.
-- A database-guarded send transition. Call only after a valid worker lease
-- and trusted customer destination have been verified by the application.
-- UNKNOWN, SENDING and SENT can NEVER be auto-retried through this function.
CREATE OR REPLACE FUNCTION timeease_begin_result_delivery(
  p_intake_id uuid,
  p_delivery_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE changed integer;
BEGIN
  IF p_intake_id IS NULL OR p_delivery_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_PARAMETERS';
  END IF;

  UPDATE timeease_delivery_ledger
  SET status = 'SENDING',
      attempt_number = attempt_number + 1,
      updated_at = now()
  WHERE intake_id = p_intake_id
    AND delivery_id = p_delivery_id
    AND status = 'PENDING';
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;
REVOKE ALL ON FUNCTION timeease_begin_result_delivery(uuid, uuid) FROM PUBLIC;

-- A successful provider response can be recorded by the active worker.
-- On timeout or ambiguous result, the caller MUST transition SENDING to
-- UNKNOWN and reconcile with the provider before any further attempt.
-- Do not change UNKNOWN to PENDING automatically.
CREATE OR REPLACE FUNCTION timeease_record_result_delivery(
  p_intake_id uuid,
  p_delivery_id uuid,
  p_provider_message_id text,
  p_confirmed boolean
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE changed integer;
BEGIN
  IF p_intake_id IS NULL OR p_delivery_id IS NULL OR p_confirmed IS NULL THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_PARAMETERS';
  END IF;
  IF p_confirmed AND (p_provider_message_id IS NULL OR length(trim(p_provider_message_id)) = 0) THEN
    RAISE EXCEPTION 'PROVIDER_MESSAGE_ID_REQUIRED';
  END IF;
  UPDATE timeease_delivery_ledger
  SET status = CASE WHEN p_confirmed THEN 'SENT' ELSE 'UNKNOWN' END,
      provider_message_id = CASE WHEN p_confirmed THEN p_provider_message_id ELSE provider_message_id END,
      updated_at = now()
  WHERE intake_id = p_intake_id
    AND delivery_id = p_delivery_id
    AND status = 'SENDING';
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;
REVOKE ALL ON FUNCTION timeease_record_result_delivery(uuid, uuid, text, boolean) FROM PUBLIC;
