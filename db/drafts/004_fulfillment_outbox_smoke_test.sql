-- Run only after 001 and 003 in a disposable PostgreSQL database.
BEGIN;
WITH claim AS (
  INSERT INTO timeease_paid_intake_claims
    (intake_id,shopify_order_id,shopify_line_item_id,shopify_variant_id,amount_cents)
  VALUES ('33333333-3333-4333-8333-333333333333','TEST-ORDER-3','TEST-LINE-3','51269543428343',900)
  ON CONFLICT DO NOTHING RETURNING intake_id,shopify_order_id
)
INSERT INTO timeease_fulfillment_outbox (intake_id,shopify_order_id)
SELECT intake_id,shopify_order_id FROM claim;

DO $$
DECLARE inserted_count integer;
BEGIN
  WITH claim AS (
    INSERT INTO timeease_paid_intake_claims
      (intake_id,shopify_order_id,shopify_line_item_id,shopify_variant_id,amount_cents)
    VALUES ('33333333-3333-4333-8333-333333333333','TEST-ORDER-3','TEST-LINE-3','51269543428343',900)
    ON CONFLICT DO NOTHING RETURNING intake_id,shopify_order_id
  )
  INSERT INTO timeease_fulfillment_outbox (intake_id,shopify_order_id)
  SELECT intake_id,shopify_order_id FROM claim;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> 0 THEN RAISE EXCEPTION 'Replay dispatched duplicate outbox row'; END IF;
  IF (SELECT count(*) FROM timeease_fulfillment_outbox WHERE shopify_order_id='TEST-ORDER-3') <> 1
  THEN RAISE EXCEPTION 'Expected exactly one outbox row'; END IF;
END $$;
ROLLBACK;
