-- Draft only. Apply after 013_require_confirmed_delivery.sql and 015_fenced_delivery_start.sql.
-- Quarantine failed workers if an email send may have occurred.
-- An ambiguous send must never return to the normal automatic retry queue.
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
  SET status = CASE
      WHEN p_success THEN 'DELIVERED'
      WHEN EXISTS (
        SELECT 1 FROM timeease_delivery_ledger d
        WHERE d.intake_id = o.intake_id
          AND d.delivery_kind = 'RESULT_EMAIL'
          AND d.status IN ('SENDING', 'UNKNOWN', 'SENT')
      ) THEN 'FAILED'
      ELSE 'PENDING'
    END,
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

-- If a lease expires while email is SENDING/UNKNOWN, the next worker may
-- reclaim the outbox row but MUST NOT send again: the ledger remains locked.
-- Operator reconciliation is required before any further delivery attempt.
