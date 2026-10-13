-- Draft only. Run in a dedicated TimeEase PostgreSQL database after review.
-- This migration is not connected to production and does not alter n8n.
-- Enforce one paid Shopify order per intake, and one processing claim per order.
CREATE TABLE IF NOT EXISTS timeease_paid_intake_claims (
  intake_id uuid PRIMARY KEY,
  shopify_order_id text NOT NULL UNIQUE,
  shopify_line_item_id text NOT NULL UNIQUE,
  shopify_variant_id text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  state text NOT NULL DEFAULT 'CLAIMED'
    CHECK (state IN ('CLAIMED', 'PROCESSING', 'COMPLETED', 'FAILED')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The application must first verify Shopify HMAC and the paid-order payload,
-- and recompute the expected quote from a private intake manifest.
-- Claim using a transaction with INSERT ... ON CONFLICT DO NOTHING RETURNING.
-- A zero-row result MUST NOT trigger processing or customer delivery.
-- A replay with the same order/intake can be acknowledged idempotently,
-- but must never trigger another worker run.
-- Production needs a transactional outbox/worker lease and retry policy
-- before the first real paid order is routed to fulfillment.
