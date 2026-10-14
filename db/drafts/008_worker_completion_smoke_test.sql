-- Rollback-only test. Requires 001, 003, 005, 007.
BEGIN;
INSERT INTO timeease_paid_intake_claims
 (intake_id,shopify_order_id,shopify_line_item_id,shopify_variant_id,amount_cents)
VALUES ('55555555-5555-4555-8555-555555555555','TEST-ORDER-5','TEST-LINE-5','51269543428343',900);
INSERT INTO timeease_fulfillment_outbox(intake_id,shopify_order_id)
VALUES ('55555555-5555-4555-8555-555555555555','TEST-ORDER-5');
DO $$
DECLARE n integer; ok boolean;
BEGIN
  SELECT count(*) INTO n FROM timeease_claim_fulfillment_job(60,3);
  IF n <> 1 THEN RAISE EXCEPTION 'Expected first lease'; END IF;
  SELECT timeease_finish_fulfillment_job('55555555-5555-4555-8555-555555555555',2,true) INTO ok;
  IF ok THEN RAISE EXCEPTION 'Wrong attempt must not finish'; END IF;
  SELECT timeease_finish_fulfillment_job('55555555-5555-4555-8555-555555555555',1,false) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'Current worker should release for retry'; END IF;
  SELECT count(*) INTO n FROM timeease_claim_fulfillment_job(60,3);
  IF n <> 1 THEN RAISE EXCEPTION 'Expected retry lease'; END IF;
  SELECT timeease_finish_fulfillment_job('55555555-5555-4555-8555-555555555555',1,true) INTO ok;
  IF ok THEN RAISE EXCEPTION 'Stale worker must not finish newer lease'; END IF;
  SELECT timeease_finish_fulfillment_job('55555555-5555-4555-8555-555555555555',2,true) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'Current worker should finish'; END IF;
  SELECT count(*) INTO n FROM timeease_claim_fulfillment_job(60,3);
  IF n <> 0 THEN RAISE EXCEPTION 'Delivered task must never be reclaimed'; END IF;
END $$;
ROLLBACK;
