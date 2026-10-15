-- TimeEase V2 payment and delivery ledger.
-- Apply only to the isolated TimeEase database after reviewing permissions.
-- An order can be bound to one intake, and each intake to one paid order.
CREATE TABLE IF NOT EXISTS timeease_v2_orders (
  intake_id uuid PRIMARY KEY,
  shopify_order_id text NOT NULL UNIQUE,
  shopify_shop_domain text NOT NULL,
  variant_id text NOT NULL,
  amount_usd integer NOT NULL CHECK (amount_usd > 0),
  customer_email text,
  source_manifest_path text NOT NULL,
  result_path text,
  delivery_message_id text UNIQUE,
  processing_attempts integer NOT NULL DEFAULT 0 CHECK (processing_attempts >= 0),
  status text NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID','PROCESSING','DELIVERED','FAILED','REVIEW_REQUIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  CONSTRAINT timeease_v2_order_id_nonempty CHECK (length(shopify_order_id) > 0)
);
CREATE INDEX IF NOT EXISTS timeease_v2_orders_status_idx ON timeease_v2_orders(status,created_at);
-- Reserve a processing attempt atomically with UPDATE ... WHERE status='PAID' RETURNING intake_id.
-- Never send email before recording a durable result and deduplication key.

-- A durable attempt lease ensures a concurrent worker cannot claim the same paid order.
-- Claim work with one atomic UPDATE and check RETURNING rows:
-- UPDATE timeease_v2_orders SET status='PROCESSING',
--   processing_started_at=now(),processing_attempts=processing_attempts+1
-- WHERE intake_id=$1 AND status='PAID' RETURNING *;
-- Reconcile stale PROCESSING rows explicitly; do not silently resend an email.
