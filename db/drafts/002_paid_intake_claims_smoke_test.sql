-- Draft transaction-level verification; run only against a disposable database.
BEGIN;
INSERT INTO timeease_paid_intake_claims
 (intake_id, shopify_order_id, shopify_line_item_id, shopify_variant_id, amount_cents)
VALUES
 ('11111111-1111-4111-8111-111111111111','TEST-ORDER-1','TEST-LINE-1','51269543428343',900)
ON CONFLICT DO NOTHING;
DO $$
DECLARE inserted_count integer;
BEGIN
  -- Replayed same order/intake must not create a second claim.
  INSERT INTO timeease_paid_intake_claims
   (intake_id, shopify_order_id, shopify_line_item_id, shopify_variant_id, amount_cents)
  VALUES
   ('11111111-1111-4111-8111-111111111111','TEST-ORDER-1','TEST-LINE-1','51269543428343',900)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> 0 THEN RAISE EXCEPTION 'Duplicate replay was accepted'; END IF;

  -- Same order linked to a different intake must also be rejected.
  INSERT INTO timeease_paid_intake_claims
   (intake_id, shopify_order_id, shopify_line_item_id, shopify_variant_id, amount_cents)
  VALUES
   ('22222222-2222-4222-8222-222222222222','TEST-ORDER-1','TEST-LINE-2','51269543428343',900)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> 0 THEN RAISE EXCEPTION 'Order reuse was accepted'; END IF;

  -- Same intake linked to a different order must be rejected.
  INSERT INTO timeease_paid_intake_claims
   (intake_id, shopify_order_id, shopify_line_item_id, shopify_variant_id, amount_cents)
  VALUES
   ('11111111-1111-4111-8111-111111111111','TEST-ORDER-2','TEST-LINE-2','51269543428343',900)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> 0 THEN RAISE EXCEPTION 'Intake reuse was accepted'; END IF;
END $$;
ROLLBACK;
