-- Rollback-only transition tests. Requires 001, 009 and 011.
BEGIN;
INSERT INTO timeease_paid_intake_claims
 (intake_id,shopify_order_id,shopify_line_item_id,shopify_variant_id,amount_cents)
VALUES ('99999999-9999-4999-8999-999999999999','TEST-ORDER-9','TEST-LINE-9','51269543428343',900);
INSERT INTO timeease_delivery_ledger(delivery_id,intake_id,delivery_kind)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','99999999-9999-4999-8999-999999999999','RESULT_EMAIL');
DO $$
DECLARE ok boolean;
BEGIN
  SELECT timeease_begin_result_delivery('99999999-9999-4999-8999-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'First send claim must succeed'; END IF;
  SELECT timeease_begin_result_delivery('99999999-9999-4999-8999-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') INTO ok;
  IF ok THEN RAISE EXCEPTION 'Concurrent duplicate send was allowed'; END IF;
  SELECT timeease_record_result_delivery('99999999-9999-4999-8999-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,false) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'Ambiguous result should be quarantined'; END IF;
  SELECT timeease_begin_result_delivery('99999999-9999-4999-8999-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') INTO ok;
  IF ok THEN RAISE EXCEPTION 'UNKNOWN delivery must never auto-resend'; END IF;
  SELECT timeease_record_result_delivery('99999999-9999-4999-8999-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','provider-123',true) INTO ok;
  IF ok THEN RAISE EXCEPTION 'UNKNOWN must not silently become SENT'; END IF;
END $$;
ROLLBACK;
