-- Rollback-only worker lease smoke test, after 001, 003 and 005.
BEGIN;
INSERT INTO timeease_paid_intake_claims
 (intake_id,shopify_order_id,shopify_line_item_id,shopify_variant_id,amount_cents)
VALUES ('44444444-4444-4444-8444-444444444444','TEST-ORDER-4','TEST-LINE-4','51269543428343',900);
INSERT INTO timeease_fulfillment_outbox (intake_id,shopify_order_id)
VALUES ('44444444-4444-4444-8444-444444444444','TEST-ORDER-4');
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM timeease_claim_fulfillment_job(60,2);
  IF n <> 1 THEN RAISE EXCEPTION 'First lease should claim exactly one task'; END IF;
  SELECT count(*) INTO n FROM timeease_claim_fulfillment_job(60,2);
  IF n <> 0 THEN RAISE EXCEPTION 'Active lease was claimed twice'; END IF;
  UPDATE timeease_fulfillment_outbox
  SET lease_until = now() - interval '1 second'
  WHERE shopify_order_id='TEST-ORDER-4';
  SELECT count(*) INTO n FROM timeease_claim_fulfillment_job(60,2);
  IF n <> 1 THEN RAISE EXCEPTION 'Expired lease should be reclaimable'; END IF;
  UPDATE timeease_fulfillment_outbox
  SET lease_until = now() - interval '1 second'
  WHERE shopify_order_id='TEST-ORDER-4';
  SELECT count(*) INTO n FROM timeease_claim_fulfillment_job(60,2);
  IF n <> 0 THEN RAISE EXCEPTION 'Retry cap must prevent another claim'; END IF;
END $$;
ROLLBACK;
