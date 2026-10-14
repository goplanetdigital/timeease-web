-- Rollback-only lease-fencing test. Requires 001,003,005,009,011,015.
BEGIN;
INSERT INTO timeease_paid_intake_claims
 (intake_id,shopify_order_id,shopify_line_item_id,shopify_variant_id,amount_cents)
VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','TEST-ORDER-16','TEST-LINE-16','51269543428343',900);
INSERT INTO timeease_fulfillment_outbox (intake_id,shopify_order_id)
VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','TEST-ORDER-16');
INSERT INTO timeease_delivery_ledger (delivery_id,intake_id,delivery_kind)
VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','dddddddd-dddd-4ddd-8ddd-dddddddddddd','RESULT_EMAIL');
DO $$
DECLARE ok boolean;
BEGIN
  SELECT timeease_begin_result_delivery('dddddddd-dddd-4ddd-8ddd-dddddddddddd','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',1) INTO ok;
  IF ok THEN RAISE EXCEPTION 'Unleased worker started delivery'; END IF;
  PERFORM timeease_claim_fulfillment_job(60,3);
  SELECT timeease_begin_result_delivery('dddddddd-dddd-4ddd-8ddd-dddddddddddd','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',2) INTO ok;
  IF ok THEN RAISE EXCEPTION 'Wrong attempt started delivery'; END IF;
  SELECT timeease_begin_result_delivery('dddddddd-dddd-4ddd-8ddd-dddddddddddd','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',1) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'Current lease should allow delivery'; END IF;
  SELECT timeease_begin_result_delivery('dddddddd-dddd-4ddd-8ddd-dddddddddddd','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',1) INTO ok;
  IF ok THEN RAISE EXCEPTION 'Second send should be rejected'; END IF;
END $$;
ROLLBACK;
