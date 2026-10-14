-- Rollback-only. Requires 001, 003, 005, 009, 013.
BEGIN;
INSERT INTO timeease_paid_intake_claims
 (intake_id,shopify_order_id,shopify_line_item_id,shopify_variant_id,amount_cents)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','TEST-ORDER-13','TEST-LINE-13','51269543428343',900);
INSERT INTO timeease_fulfillment_outbox(intake_id,shopify_order_id)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','TEST-ORDER-13');
INSERT INTO timeease_delivery_ledger(delivery_id,intake_id,delivery_kind)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','RESULT_EMAIL');
DO $$
DECLARE ok boolean;
BEGIN
  PERFORM timeease_claim_fulfillment_job(60,3);
  SELECT timeease_finish_fulfillment_job('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,true) INTO ok;
  IF ok THEN RAISE EXCEPTION 'Cannot complete before delivery'; END IF;
  UPDATE timeease_delivery_ledger SET status='UNKNOWN'
    WHERE intake_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  SELECT timeease_finish_fulfillment_job('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,true) INTO ok;
  IF ok THEN RAISE EXCEPTION 'UNKNOWN delivery must block completion'; END IF;
  UPDATE timeease_delivery_ledger SET status='SENT',provider_message_id='test-message-13'
    WHERE intake_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  SELECT timeease_finish_fulfillment_job('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,true) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'Confirmed delivery should allow completion'; END IF;
END $$;
ROLLBACK;
