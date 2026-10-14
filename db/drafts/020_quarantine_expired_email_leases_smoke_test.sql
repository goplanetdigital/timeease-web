-- Rollback-only regression for expired lease quarantine.
BEGIN;
INSERT INTO timeease_paid_intake_claims
 (intake_id,shopify_order_id,shopify_line_item_id,shopify_variant_id,amount_cents)
VALUES
 ('11111111-1111-4111-8111-111111111111','TEST-ORDER-20A','TEST-LINE-20A','51269543428343',900),
 ('22222222-2222-4222-8222-222222222222','TEST-ORDER-20B','TEST-LINE-20B','51269543428343',900);
INSERT INTO timeease_fulfillment_outbox(intake_id,shopify_order_id,status,attempt_count,lease_until)
VALUES
 ('11111111-1111-4111-8111-111111111111','TEST-ORDER-20A','PROCESSING',1,now()-interval '5 minutes'),
 ('22222222-2222-4222-8222-222222222222','TEST-ORDER-20B','PROCESSING',1,now()-interval '5 minutes');
INSERT INTO timeease_delivery_ledger(delivery_id,intake_id,delivery_kind,status)
VALUES ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','RESULT_EMAIL','SENDING');
DO $$
DECLARE claimed uuid; state text;
BEGIN
  SELECT claimed_intake_id INTO claimed FROM timeease_claim_fulfillment_job(60,3);
  IF claimed IS DISTINCT FROM '22222222-2222-4222-8222-222222222222'::uuid
    THEN RAISE EXCEPTION 'Expected only safe expired lease to be reclaimed, got %',claimed; END IF;
  SELECT status INTO state FROM timeease_fulfillment_outbox
    WHERE intake_id='11111111-1111-4111-8111-111111111111';
  IF state <> 'FAILED' THEN RAISE EXCEPTION 'Ambiguous expired lease must be quarantined'; END IF;
END $$;
ROLLBACK;
