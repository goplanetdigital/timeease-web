-- Rollback-only delivery ledger smoke test. Requires 001 and 009.
BEGIN;
INSERT INTO timeease_paid_intake_claims
 (intake_id,shopify_order_id,shopify_line_item_id,shopify_variant_id,amount_cents)
VALUES ('66666666-6666-4666-8666-666666666666','TEST-ORDER-6','TEST-LINE-6','51269543428343',900);
INSERT INTO timeease_delivery_ledger(delivery_id,intake_id,delivery_kind)
VALUES ('77777777-7777-4777-8777-777777777777','66666666-6666-4666-8666-666666666666','RESULT_EMAIL');
DO $$
DECLARE inserted_count integer;
BEGIN
  INSERT INTO timeease_delivery_ledger(delivery_id,intake_id,delivery_kind)
  VALUES ('88888888-8888-4888-8888-888888888888','66666666-6666-4666-8666-666666666666','RESULT_EMAIL')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> 0 THEN RAISE EXCEPTION 'Duplicate delivery identity accepted'; END IF;
  UPDATE timeease_delivery_ledger SET status='UNKNOWN'
  WHERE intake_id='66666666-6666-4666-8666-666666666666';
  IF (SELECT count(*) FROM timeease_delivery_ledger
      WHERE intake_id='66666666-6666-4666-8666-666666666666' AND status='UNKNOWN') <> 1
  THEN RAISE EXCEPTION 'Ambiguous delivery state was lost'; END IF;
END $$;
ROLLBACK;
