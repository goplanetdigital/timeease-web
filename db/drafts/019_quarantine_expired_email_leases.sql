-- Draft: apply after 017. Prevent expired leases with ambiguous email from being reclaimed.
CREATE OR REPLACE FUNCTION timeease_claim_fulfillment_job(
  p_lease_seconds integer DEFAULT 300, p_max_attempts integer DEFAULT 5
)
RETURNS TABLE (claimed_intake_id uuid, claimed_order_id text, attempt_number integer)
LANGUAGE plpgsql AS $$
BEGIN
  IF p_lease_seconds IS NULL OR p_max_attempts IS NULL OR
     p_lease_seconds < 30 OR p_lease_seconds > 3600 OR
     p_max_attempts < 1 OR p_max_attempts > 20 THEN
    RAISE EXCEPTION 'INVALID_LEASE_PARAMETERS';
  END IF;
  -- Quarantine expired workers whose email delivery has started or become ambiguous.
  UPDATE timeease_fulfillment_outbox o
  SET status = 'FAILED', lease_until = NULL, updated_at = now()
  WHERE o.status = 'PROCESSING' AND o.lease_until < now()
    AND EXISTS (
      SELECT 1 FROM timeease_delivery_ledger d
      WHERE d.intake_id = o.intake_id AND d.delivery_kind = 'RESULT_EMAIL'
        AND d.status IN ('SENDING','UNKNOWN','SENT')
    );

  RETURN QUERY
  WITH candidate AS (
    SELECT o.intake_id FROM timeease_fulfillment_outbox o
    WHERE (o.status = 'PENDING' OR
           (o.status = 'PROCESSING' AND o.lease_until < now()))
      AND o.attempt_count < p_max_attempts
      AND NOT EXISTS (
        SELECT 1 FROM timeease_delivery_ledger d
        WHERE d.intake_id = o.intake_id AND d.delivery_kind = 'RESULT_EMAIL'
          AND d.status IN ('SENDING','UNKNOWN','SENT','FAILED')
      )
    ORDER BY o.created_at, o.intake_id
    FOR UPDATE OF o SKIP LOCKED LIMIT 1
  ), claimed AS (
    UPDATE timeease_fulfillment_outbox o
    SET status='PROCESSING', attempt_count=o.attempt_count+1,
        lease_until=now()+make_interval(secs=>p_lease_seconds), updated_at=now()
    FROM candidate c WHERE o.intake_id=c.intake_id
    RETURNING o.intake_id,o.shopify_order_id,o.attempt_count
  )
  SELECT c.intake_id,c.shopify_order_id,c.attempt_count FROM claimed c;
END;
$$;
REVOKE ALL ON FUNCTION timeease_claim_fulfillment_job(integer, integer) FROM PUBLIC;
