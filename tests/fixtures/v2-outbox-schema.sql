-- Local PostgreSQL test schema matching the reviewed tables, with proposed V2 FKs.
-- Never applied by the app, build or Neon test runner.
CREATE TABLE public.timeease_v2_orders (
 intake_id uuid PRIMARY KEY,shopify_order_id text NOT NULL UNIQUE,
 shopify_shop_domain text NOT NULL,variant_id text NOT NULL,
 amount_usd integer NOT NULL CHECK(amount_usd>0),customer_email text,
 source_manifest_path text NOT NULL,result_path text,delivery_message_id text UNIQUE,
 processing_attempts integer NOT NULL DEFAULT 0 CHECK(processing_attempts>=0),
 status text NOT NULL DEFAULT 'PAID' CHECK(status IN ('PAID','PROCESSING','DELIVERED','FAILED','REVIEW_REQUIRED')),
 created_at timestamptz NOT NULL DEFAULT now(),processing_started_at timestamptz,
 delivered_at timestamptz,last_error text,CHECK(length(shopify_order_id)>0));
CREATE TABLE public.timeease_paid_intake_claims (
 intake_id uuid PRIMARY KEY,shopify_order_id text NOT NULL UNIQUE,
 shopify_line_item_id text NOT NULL UNIQUE,shopify_variant_id text NOT NULL,
 amount_cents integer NOT NULL CHECK(amount_cents>0),currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 state text NOT NULL DEFAULT 'CLAIMED' CHECK(state IN ('CLAIMED','PROCESSING','COMPLETED','FAILED')),
 claimed_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.timeease_fulfillment_outbox (
 intake_id uuid PRIMARY KEY,shopify_order_id text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','DELIVERED','FAILED')),
 attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT timeease_fulfillment_outbox_intake_id_fkey FOREIGN KEY(intake_id) REFERENCES public.timeease_v2_orders(intake_id));
CREATE TABLE public.timeease_delivery_ledger (
 delivery_id uuid PRIMARY KEY,intake_id uuid NOT NULL,delivery_kind text NOT NULL CHECK(delivery_kind='RESULT_EMAIL'),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENDING','SENT','UNKNOWN','FAILED')),
 provider_message_id text UNIQUE,attempt_number integer NOT NULL DEFAULT 0 CHECK(attempt_number>=0),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(intake_id,delivery_kind),
 CONSTRAINT timeease_delivery_ledger_intake_id_fkey FOREIGN KEY(intake_id) REFERENCES public.timeease_v2_orders(intake_id));
