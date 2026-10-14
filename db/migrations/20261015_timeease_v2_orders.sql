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
