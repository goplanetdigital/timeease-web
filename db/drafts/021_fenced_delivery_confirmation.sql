-- Draft: apply after 019. Fence delivery confirmation to the active worker attempt.
-- Do not expose either function to public clients.
CREATE OR REPLACE FUNCTION timeease_record_result_delivery(
  p_intake_id uuid, p_delivery_id uuid, p_attempt_number integer,
  p_provider_message_id text, p_confirmed boolean
)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE changed integer;
BEGIN
  IF p_intake_id IS NULL OR p_delivery_id IS NULL OR p_attempt_number IS NULL
    OR p_attempt_number < 1 OR p_confirmed IS NULL THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_PARAMETERS';
  END IF;
  IF p_confirmed AND (p_provider_message_id IS NULL OR length(trim(p_provider_message_id)) = 0) THEN
    RAISE EXCEPTION 'PROVIDER_MESSAGE_ID_REQUIRED';
  END IF;
  UPDATE timeease_delivery_ledger d
  SET status = CASE WHEN p_confirmed THEN 'SENT' ELSE 'UNKNOWN' END,
      provider_message_id = CASE WHEN p_confirmed THEN trim(p_provider_message_id) ELSE provider_message_id END,
      updated_at = now()
  WHERE d.intake_id = p_intake_id
    AND d.delivery_id = p_delivery_id
    AND d.status = 'SENDING'
    AND d.attempt_number = p_attempt_number
    AND EXISTS (
      SELECT 1 FROM timeease_fulfillment_outbox o
      WHERE o.intake_id = d.intake_id AND o.status = 'PROCESSING'
        AND o.attempt_count = p_attempt_number AND o.lease_until > now()
    );
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;
DROP FUNCTION IF EXISTS timeease_record_result_delivery(uuid,uuid,text,boolean);
REVOKE ALL ON FUNCTION timeease_record_result_delivery(uuid,uuid,integer,text,boolean) FROM PUBLIC;
-- Expired or ambiguous provider responses require separate, operator-only reconciliation.
