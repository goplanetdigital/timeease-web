# TimeEase V2 payment ledger rollout

This is a **manual production migration**. The SQL is in `migrations/20261015_timeease_v2_orders.sql`.

1. Verify the connected Neon database belongs to TimeEase, and back up its schema.
2. Apply the SQL in the Neon SQL editor using an authorized database owner. Do not paste database passwords into GitHub.
3. Confirm `SELECT to_regclass('public.timeease_v2_orders');` returns the table name.
4. Confirm the Vercel `TIMEEASE_DB_DATABASE_URL` points to the same database.
5. Configure a genuine Shopify app webhook signing secret and subscribe `orders/paid` to `/api/webhooks/shopify`.
6. Only after a signed test paid order creates one row, verify worker processing and delivery with the **same original uploaded file**.
7. Only after that E2E test, set the payment ledger, delivery verification and checkout flags to `true`.

Never turn on customer checkout simply because the schema exists. Never use a fabricated Shopify signing secret. A webhook HTTP 200 means a paid order was registered, **not** that a result was delivered.
