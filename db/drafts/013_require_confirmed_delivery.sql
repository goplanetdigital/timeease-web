-- Draft hardening: apply AFTER 007_worker_completion.sql and 009_delivery_ledger.sql.
-- A worker may report success only after a confirmed SENT result email.
CREATE OR REPLACE FUNCTION timeease_finish_fulfillment_job(
  p_intake_id uuid, p_attempt_number integer, p_success boolean
)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE changed integer;
BEGIN
  IF p_intake_id IS NULL OR p_attempt_number IS NULL OR p_attempt_number < 1
     OR p_success IS NULL THEN
    RAISE EXCEPTION 'INVALID_FINISH_PARAMETERS';
  END IF;

  UPDATE timeease_fulfillment_outbox o
  SET status = CASE WHEN p_success THEN 'DELIVERED' ELSE 'PENDING' END,
      lease_until = NULL,
      updated_at = now()
  WHERE o.intake_id = p_intake_id
    AND o.status = 'PROCESSING'
    AND o.attempt_count = p_attempt_number
    AND o.lease_until > now()
    AND (
      NOT p_success
      OR EXISTS (
        SELECT 1 FROM timeease_delivery_ledger d
        WHERE d.intake_id = o.intake_id
          AND d.delivery_kind = 'RESULT_EMAIL'
          AND d.status = 'SENT'
          AND d.provider_message_id IS NOT NULL
      )
    );
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;
REVOKE ALL ON FUNCTION timeease_finish_fulfillment_job(uuid, integer, boolean) FROM PUBLIC;
