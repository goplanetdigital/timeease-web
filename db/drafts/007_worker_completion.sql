-- Draft only. Requires 001, 003 and 005.
-- attempt_count is the fencing token: an expired worker cannot acknowledge
-- a newer worker's lease. Invoke using trusted server credentials only.
CREATE OR REPLACE FUNCTION timeease_finish_fulfillment_job(
  p_intake_id uuid,
  p_attempt_number integer,
  p_success boolean
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
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
    AND o.lease_until > now();
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;
REVOKE ALL ON FUNCTION timeease_finish_fulfillment_job(uuid, integer, boolean) FROM PUBLIC;

-- NOTE: p_success must be true only AFTER downstream delivery is confirmed
-- idempotently. Otherwise a crash between sending and recording success
-- can still produce duplicate delivery. Add a delivery idempotency key.
