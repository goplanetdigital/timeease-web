-- Rollback-only regression: ambiguous email must not return to retry queue.
BEGIN;
INSERT INTO timeease_paid_intake_claims
 (intake_id,shopify_order_id,shopify_line_item_id,shopify_variant_id,amount_cents)
VALUES
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','TEST-ORDER-18A','TEST-LINE-18A','51269543428343',900),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','TEST-ORDER-18B','TEST-LINE-18B','51269543428343',900);
INSERT INTO timeease_fulfillment_outbox(intake_id,shopify_order_id,status,attempt_count,lease_until)
VALUES
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','TEST-ORDER-18A','PROCESSING',1,now()+interval '5 minutes'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','TEST-ORDER-18B','PROCESSING',1,now()+interval '5 minutes');
INSERT INTO timeease_delivery_ledger(delivery_id,intake_id,delivery_kind,status)
VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dddddddd-dddd-4ddd-8ddd-dddddddddddd','RESULT_EMAIL','UNKNOWN'),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','RESULT_EMAIL','PENDING');
DO $$
DECLARE ok boolean; state text;
BEGIN
  SELECT timeease_finish_fulfillment_job('dddddddd-dddd-4ddd-8ddd-dddddddddddd',1,false) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'Ambiguous delivery failure not recorded'; END IF;
  SELECT status INTO state FROM timeease_fulfillment_outbox WHERE intake_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  IF state <> 'FAILED' THEN RAISE EXCEPTION 'UNKNOWN must be quarantined, got %', state; END IF;
  SELECT timeease_finish_fulfillment_job('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',1,false) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'Safe retry failure not recorded'; END IF;
  SELECT status INTO state FROM timeease_fulfillment_outbox WHERE intake_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  IF state <> 'PENDING' THEN RAISE EXCEPTION 'PENDING delivery should be retryable, got %', state; END IF;
END $$;
ROLLBACK;
