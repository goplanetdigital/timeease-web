-- Draft only: requires 001_paid_intake_claims.sql.
-- Transactional outbox: one fulfillment event per claimed intake.
CREATE TABLE IF NOT EXISTS timeease_fulfillment_outbox (
  intake_id uuid PRIMARY KEY REFERENCES timeease_paid_intake_claims(intake_id),
  shopify_order_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','PROCESSING','DELIVERED','FAILED')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Example transaction for a VERIFIED paid order, after private manifest
-- quote verification. Bind all parameters through a SQL client; NEVER use
-- string interpolation. A new claim and its outbox row commit together.
--
-- BEGIN;
-- WITH claim AS (
--   INSERT INTO timeease_paid_intake_claims
--     (intake_id,shopify_order_id,shopify_line_item_id,
--      shopify_variant_id,amount_cents,currency)
--   VALUES ($1,$2,$3,$4,$5,'USD')
--   ON CONFLICT DO NOTHING
--   RETURNING intake_id,shopify_order_id
-- )
-- INSERT INTO timeease_fulfillment_outbox (intake_id,shopify_order_id)
-- SELECT intake_id,shopify_order_id FROM claim;
-- COMMIT;
--
-- If the INSERT returns zero rows, do NOT dispatch another worker.
-- Worker leasing, retries, dead-letter handling, and idempotent delivery
-- MUST be implemented before enabling fulfillment.
