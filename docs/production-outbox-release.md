# PR20 P0 release wiring (not a Production release)

No Production configuration/database/workflow was changed. Preview business
routes remain closed; the accepted exact-ID synthetic adapter and Outbox core
are unchanged. Do not seed/reset/replay the eight terminal Preview fixtures.

## Scope and default-closed configuration

Target of a future separately approved release: existing public
`timeease-ruby.vercel.app`, Vercel project `prj_2w1jB9WzF64hLNb6jRDxQw3LGSKR`.
The separate `timeease-v2-secure` Preview project cannot satisfy this release
binding, even if marked production or given the old checkout flags.
The database identity must be odd-base-63790740 / br-wispy-river-aoo9eown /
neondb, verified from the live SQL connection before order access. Worker and
payment URLs must name their distinct limited roles and use verified TLS.
There is no payment-owner URL fallback and no runtime migration/role repair.

New opt-ins (all currently absent/false, no config writes in this change):
`TIMEEASE_V2_OUTBOX_ENABLED=true`, exact `TIMEEASE_RELEASE_COMMIT_SHA` matching
`VERCEL_GIT_COMMIT_SHA`, `TIMEEASE_RELEASE_ACCEPTING_WORK=true` and
`TIMEEASE_RELEASE_SEND_ENABLED=true`. Existing payment/checkout/delivery flags
are insufficient. Worker activation is a separate operator action; no code or
CI step activates it. Stripe billing mutation routes are deliberately closed:
that separate subscription/credit path lacks authenticated atomic credit/event
accounting and is excluded from this Shopify single-task release.

## Actual transaction boundaries

`/api/worker/report` now calls the accepted V2 Outbox module inside a single
scoped transaction, after database identity/constraints/grants/hold-table checks.
Transactions bound lock waits to 3s, SQL statements to 5s and idle-in-transaction time to 10s.
All mutations lock the shop/order advisory key, V2 order, Outbox, Ledger in a
consistent order. A SQL error causes ROLLBACK, never a fallback to legacy send.
Result storage remains private; Blob writes precede publication. A failed SQL
publication leaves the immutable object for audit/reconciliation; do not blindly
upload again or delete it. Result-ready can be retried against an existing
verified object. No result verification error produces a send authorization.

- `result_ready`: fixed result path/Blob metadata -> result + real Outbox + Ledger.
- `outbox_claim`: requires accepting-work + send gates and no payment hold;
  one lease yields `send=true` and a server-created `deliveryId`.
- `delivered`: require that same `deliveryId` and valid Gmail API `messageId`;
  atomically V2 DELIVERED / Outbox DELIVERED / Ledger SENT. Replays use the same
  receipt; a different delivery ID is rejected. This does not independently
  prove inbox delivery; future trusted n8n sender must bind the real receipt.
- `failed_before_send`: only when caller knows no provider request happened.
- `review`: ambiguous provider outcome -> FAILED/UNKNOWN/REVIEW_REQUIRED.
- `recover` (or `/api/worker/recover` with exact `intakeId`): only expired leases;
  no forced clock, timestamp overrides or automatic reclaim/resend.
- Legacy `reserve_delivery` is rejected; no old completion fallback exists.

Pending discovery separates `intakeIds`, `deliveryIntakeIds` and expired
`recoveryIntakeIds`. Freezing work/sends returns no new conversion/delivery
IDs, but retains recovery discovery. Ops-status adds Outbox/Ledger counts and
expired lease counts without exposing customer IDs or addresses.

## Payment authority and reversed/out-of-order payments

Only a signed Shopify `orders/paid` with `test=false`, financial_status=paid,
USD exact amount/variant/quantity and the server binding can insert PAID.
Pending/authorized/partial/unpaid/test payloads cannot authorize fulfillment.
Signed `orders/cancelled` and `refunds/create` create a monotonic shop/order hold,
including before the paid webhook arrives. Late paid cannot erase the hold or
reopen an order. Holds and row transitions share a transaction/advisory lock.
Any refund, including partial, is conservatively manual review before further
sending; no automated refund or payment modification is performed.

Delivered and already-reviewed order rows/counters/receipts stay unchanged.
Reversal of a leased delivery marks Ledger UNKNOWN, never grants another send.
A provider request already in flight cannot be recalled: its outcome remains
manual reconciliation, with no automatic resend. This limitation is not an
exactly-once/inbox-delivery guarantee.

Stripe PaymentIntent events from Shopify are processor observations, not a
second fulfillment authority. No Stripe endpoint, event subscription or active
legacy n8n graph was changed. The old active Shopify Intake's published version
still needs operator review/retirement: its draft HMAC guard is not live.

## Proposed migration and future n8n binding

`production-outbox-migration.proposed.sql` is operator-review-only. It checks the
exact Production identity, empty legacy/delivery tables, expected old FKs and
absence of conflicting roles. It changes only two FK targets, adds monotonic
holds and two NOLOGIN roles with purpose-specific column grants. It does not
modify the four existing Production V2 orders or execute at app/build startup.
LOGIN/secret provisioning, migration and Production deployment require separate
approval; nothing in this PR performs them.

Before any sender is activated, export/review a new inactive n8n release version
with all endpoints on the exact approved public domain. Replace old reservation
with `outbox_claim`; require `ok=true`, `send=true` and a delivery UUID. Carry
that UUID through the XLSX attachment/Gmail node and return it with the actual
Gmail receipt. The sender must not retry Gmail after a timeout; report `review`.
Recovery must use explicit IDs from recovery discovery, not the old bulk
order-only recovery body. Export the published revision to the release record.
Do not edit/activate the current legacy workflows as part of this code change.

## Rollback / stop sequence

1. Set accepting-work and send flags false (future separately approved operation).
   Stop checkout/new claims and the external sender. Keep the bound Outbox version
   deployed for receipt and reversal intake/recovery. These do not depend on the
   accepting-work/send switches; keep Outbox enabled and the SHA binding intact.
2. Reconcile in-flight sends as SENT with real bound receipts or UNKNOWN/manual
   review. Keep paid-but-unfulfilled jobs recorded. Never requeue reviewed rows.
3. Roll back application/workflow as one reviewed release after drain. Do not
   restore a legacy sender/report implementation that bypasses Outbox. A rollback
   to another commit requires its matching release binding; it stays closed until
   explicitly configured. Same-project rollback targets only.
4. Before data, a separately reviewed schema reversal is possible; after holds,
   Outbox or receipt data exists, retain schema and audit. No cleanup, reset,
   receipt fabrication or destructive down-migration is included.

## Validation and remaining approval gates

CI runs the changed Production integration/guard tests with local PostgreSQL
(PGlite), typecheck and build. It verifies accepted Preview core/adapter sources
are byte-identical to 4e656ac5092668c6474290dd15ac1e92209581ee and reuses their
recorded PASS evidence instead of rerunning the core suite. Local tests do not
claim Neon multi-session concurrency, real mail, Live payment or Production E2E.

Remaining: approve new Production migration/role provisioning; verify actual
Shopify webhook destinations/delivery history and reversal topics; retire unsafe
legacy graphs; bind/review the inactive n8n sender and monitoring release; perform
only missing isolated integration/mail-receipt acceptance with fresh approved
fixtures, then separately approve Production deployment/flags/activation. PR20
remains Draft. Never rerun Shopify #1033 or terminal synthetic orders.
