-- Draft only. Apply AFTER 011_delivery_transitions.sql and 013_require_confirmed_delivery.sql.
-- Harden the delivery start: only the holder of a live outbox lease can send.
-- The attempt counter acts as a fencing token to reject stale workers.
CREATE OR REPLACE FUNCTION timeease_begin_result_delivery(
  p_intake_id uuid,
  p_delivery_id uuid,
  p_attempt_number integer
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE changed integer;
BEGIN
  IF p_intake_id IS NULL OR p_delivery_id IS NULL
     OR p_attempt_number IS NULL OR p_attempt_number < 1 THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_PARAMETERS';
  END IF;

  UPDATE timeease_delivery_ledger d
  SET status = 'SENDING',
      attempt_number = p_attempt_number,
      updated_at = now()
  WHERE d.intake_id = p_intake_id
    AND d.delivery_id = p_delivery_id
    AND d.status = 'PENDING'
    AND EXISTS (
      SELECT 1 FROM timeease_fulfillment_outbox o
      WHERE o.intake_id = d.intake_id
        AND o.status = 'PROCESSING'
        AND o.attempt_count = p_attempt_number
        AND o.lease_until > now()
    );
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;

-- Remove the earlier two-argument entry point: it had no lease check.
DROP FUNCTION IF EXISTS timeease_begin_result_delivery(uuid, uuid);
REVOKE ALL ON FUNCTION timeease_begin_result_delivery(uuid, uuid, integer) FROM PUBLIC;

-- IMPORTANT: this guards starting a send; the provider may still accept a
-- request just as a lease expires. Never auto-resend SENDING or UNKNOWN.
-- Before production, bind confirmation to the same attempt and use a
-- provider idempotency key or a manual reconciliation procedure.
