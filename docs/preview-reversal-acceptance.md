# Fixed Preview reversal acceptance adapter

This is a test adapter, not a change to the Shopify Live endpoint. It reuses
shopifyPaymentState and holdShopifyPayment in a scoped transaction. No previous
accepted tests or old terminal fixtures should be rerun.

POST /api/test-worker/shopify-reversal requires existing Preview bearer and
Deployment Protection, the exact isolated deployment host/branch/project,
ledger and checkout flags false, x-shopify-shop-domain=preview.invalid, a fixed
topic/payload and raw-body HMAC. The public synthetic FIXTURE_SIGNING_KEY in
lib/preview-shopify-reversal.ts is a test vector, not an authentication secret or
a Shopify Live secret. Anyone knowing that fixture key still needs the existing
independent Preview authorization. This cannot establish Live signature pairing.

Only two newly inserted fixtures are accepted:

| Topic | intake_id | synthetic Shopify order ID |
| --- | --- | --- |
| orders/cancelled | 831a428d-fb7b-4dfc-a025-0486478c4201 | 900000001108001 |
| refunds/create | 831a428d-fb7b-4dfc-a025-0486478c4202 | 900000001108002 |

Both use reversal@example.invalid, preview.invalid, synthetic-invoice, USD1
synthetic state only, attempts=0 and no result/receipt. They were safely inserted
on odd-base-63790740 / br-restless-hill-ao5vpgb4 / neondb with collision guards.
Do not seed again. Existing eight fixtures and legacy 20 rows are untouched.

The dedicated new login timeease_preview_reversal_20261108 was provisioned only
on that Preview branch, with NOINHERIT and membership in the existing restricted
timeease_payment_limited role, without ADMIN OPTION or new grants to old roles.
It has a 2026-11-10 00:00 UTC expiration. The adapter checks native TLS certificate
authorization, login, branch/project/database before SET LOCAL ROLE. It only
accepts pristine fixture rows. It freezes via the existing monotonic HOLD module,
verifies the new status/hold and a fingerprint of all unrelated V2 orders before
COMMIT. No provider, Worker, Blob, payment creation, cleanup or runtime DDL exists.

Environment provisioning has NOT succeeded. Required only on isolated Preview
project prj_Wx1x2G8gOdvuhZqHd8goSZyvQ077, branch
feature/isolated-worker-diagnostics-20261026:

- TIMEEASE_PREVIEW_PROJECT_ID = prj_Wx1x2G8gOdvuhZqHd8goSZyvQ077
- TIMEEASE_PREVIEW_REVERSAL_DATABASE_URL = a sensitive, Preview-only URL for the
  dedicated new login and ep-soft-morning-aokq5owy, neondb, sslmode=verify-full.

Never modify shared TIMEEASE_DB_DATABASE_URL, use a Production role/password, copy
SHOPIFY_WEBHOOK_SECRET to Preview, or remove the formal productionReleaseBound
gate. A blocked configuration write must be resolved before external HTTP; do
not report local source tests as external HMAC/freeze PASS. The new login is left
NOLOGIN while provisioning is blocked; fixtures stay pristine until that is fixed.

Rollback before acceptance: keep the new login NOLOGIN, remove only the two new
Preview env keys and revert this adapter commit. No destructive database cleanup
is needed. After acceptance keep REVIEW_REQUIRED fixtures/holds for evidence;
never reset or delete terminal orders. Role expiry plus NOLOGIN is the cleanup
control; removing role/fixture rows would require separately reviewed cleanup.

Production connection validation remains blocked independently: the actual
release needs the new TIMEEASE_PAYMENT_DATABASE_URL, native client TLS and exact
identity proof, plus two remaining FK differences. This adapter cannot prove
Production connectivity and must never be pointed at Production.
