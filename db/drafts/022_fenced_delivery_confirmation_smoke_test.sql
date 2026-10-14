-- Rollback-only test: stale worker cannot confirm an email.
BEGIN;
INSERT INTO timeease_paid_intake_claims
 (intake_id,shopify_order_id,shopify_line_item_id,shopify_variant_id,amount_cents)
VALUES ('44444444-4444-4444-8444-444444444444','TEST-ORDER-22','TEST-LINE-22','51269543428343',900);
INSERT INTO timeease_fulfillment_outbox(intake_id,shopify_order_id,status,attempt_count,lease_until)
VALUES ('44444444-4444-4444-8444-444444444444','TEST-ORDER-22','PROCESSING',2,now()+interval '5 minutes');
INSERT INTO timeease_delivery_ledger(delivery_id,intake_id,delivery_kind,status,attempt_number)
VALUES ('55555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444444','RESULT_EMAIL','SENDING',2);
DO $$
DECLARE ok boolean; state text;
BEGIN
 SELECT timeease_record_result_delivery('44444444-4444-4444-8444-444444444444',
 '55555555-5555-4555-8555-555555555555',1,'stale-msg',true) INTO ok;
 IF ok THEN RAISE EXCEPTION 'Stale attempt must be rejected'; END IF;
 SELECT timeease_record_result_delivery('44444444-4444-4444-8444-444444444444',
 '55555555-5555-4555-8555-555555555555',2,'confirmed-msg',true) INTO ok;
 IF NOT ok THEN RAISE EXCEPTION 'Active attempt must confirm'; END IF;
 SELECT status INTO state FROM timeease_delivery_ledger
 WHERE intake_id='44444444-4444-4444-8444-444444444444';
 IF state <> 'SENT' THEN RAISE EXCEPTION 'Expected SENT'; END IF;
END $$;
ROLLBACK;
