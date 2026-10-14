-- Draft only. Requires 001 and 003. Delivery idempotency ledger.
-- Unique (intake_id, delivery_kind) prevents creating multiple delivery
-- identities for the same artifact type. Do not store signed download URLs.
CREATE TABLE IF NOT EXISTS timeease_delivery_ledger (
  delivery_id uuid PRIMARY KEY,
  intake_id uuid NOT NULL REFERENCES timeease_paid_intake_claims(intake_id),
  delivery_kind text NOT NULL CHECK (delivery_kind IN ('RESULT_EMAIL')),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','SENDING','SENT','UNKNOWN','FAILED')),
  provider_message_id text UNIQUE,
  attempt_number integer NOT NULL DEFAULT 0 CHECK (attempt_number >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (intake_id, delivery_kind)
);
-- IMPORTANT: Database uniqueness alone does NOT make external email sending
-- exactly once. If provider succeeds and response is lost, set UNKNOWN and
-- reconcile provider message status before any retry. A provider supporting
-- idempotency keys should receive delivery_id as its stable key.
-- Never automatically resend UNKNOWN without confirmation.
