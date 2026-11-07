# Preview order delivery E2E: read-only audit, 2026-10-27

Status: BLOCKED. This document is evidence and a proposed repair scope, not an E2E acceptance result. No runtime code, environment variables, order rows, secrets, Production resources or Shopify orders were changed by this audit.

## Verified targets

- Repository: goplanetdigital/timeease-web, PR #20, OPEN and DRAFT.
- Runtime commit: 4cbb2e51ba0f5349fc5d6f61b6bd057c02d26455.
- CI run 40361806114: completed/success.
- Preview deployment: dpl_BvSsmxWhiDgWCsiuMi2Zof4zEp51, READY, target null (Preview).
- Preview hostname: timeease-v2-secure-oebj9p04r-go-planet-digital.vercel.app.
- Neon project odd-base-63790740, branch br-rough-butterfly-aox5mukp, database neondb.
- Retain all prior database identity, client TLS, least-privilege and private Blob acceptance evidence. None of those tests were repeated here.

## Business and Worker call chain

1. POST /api/intake stores documents and manifest, returning AWAITING_PAYMENT.
2. POST /api/checkout binds the intake to a signed Shopify checkout.
3. POST /api/webhooks/shopify accepts only verified orders/paid events and uses recordVerifiedPayment.
4. GET /api/worker/pending discovers PAID rows; POST /api/worker/claim atomically changes one row to PROCESSING.
5. GET /api/worker/manifest and /source require the claimed order before reading private documents.
6. Worker extracts invoice data, validates totals, builds XLSX, uploads /api/worker/result and reports result_ready.
7. Worker sends the attachment, validates the provider receipt, then reports delivered.
8. Failed or uncertain processing is quarantined to REVIEW_REQUIRED. Recovery never automatically resends an email.

## Actual blockers

- lib/preview-blob-guard.ts intentionally blocks ALL Preview business Blob access, including intake, webhook, manifest, source, result and report. Passing the synthetic storage probe does not change this guard.
- Current Worker routes require TIMEEASE_V2_PAYMENT_LEDGER_ENABLED=true and TIMEEASE_V2_WORKER_SECRET. Current isolated Preview requires the ledger flag=false. Metadata shows only the independent Preview TIMEEASE_TEST_WORKER_SECRET; no TIMEEASE_V2_WORKER_SECRET is configured for this project. Secret values were not requested.
- Existing n8n workflow Zq06lp0qNiDzCdSy is inactive, activeVersionId=null, version cd842f74-6f63-4001-ba14-432020e61632. Its full order HTTP chain points to https://timeease-ruby.vercel.app and references the legacy TimeEase V2 Worker Auth credential. It was NOT executed or repointed. Node names containing '(disabled)' are labels; the whole workflow being inactive is the verified scheduling safeguard.
- Read-only query returned order_count=0. Both owner and limited-role connector sessions report transaction_read_only=on; default_transaction_read_only=off. This is a read-only connector transaction, not a reason to change a database default. The Worker has no INSERT permission and must retain that restriction.
- Vercel connector authenticated-fetch operation accepts only a URL, not POST/body/Authorization headers. Cloud Browser reaches Vercel sign-in rather than the protected Preview. Its session differs from the user's desktop session. Authentication is incomplete; no protected POST was sent.

## Idempotency and failure audit (code/schema evidence only)

- Actual database constraints include PRIMARY KEY(intake_id), UNIQUE(shopify_order_id) and UNIQUE(delivery_message_id).
- recordVerifiedPayment uses INSERT ON CONFLICT DO NOTHING and then checks that the existing binding matches. Conflicting bindings are rejected.
- claimPaidJob uses UPDATE WHERE status='PAID' plus the exact canonical manifest path and checks RETURNING. Concurrent or repeated claims cannot both return a claimed row.
- markResultReady requires PROCESSING and result_path IS NULL. Duplicate reports currently return a conflict rather than acknowledging the first report.
- markDelivered requires PROCESSING, a non-null result and no delivery_message_id. A repeated delivered report cannot create a second state transition.
- Stale PROCESSING orders become REVIEW_REQUIRED with PROCESSING_TIMEOUT_MANUAL_REVIEW_NO_AUTO_RESEND. Gmail failure or uncertain delivered-state updates have review branches; email retryOnFail=false.
- This provides at-most-one claim plus no automatic uncertain-email retry. It does not prove exactly-once provider delivery. A crash after email send but before the delivered update requires manual reconciliation.
- Existing n8n duplicate-delivery test uses an in-memory synthetic JSON fixture. It is not a real database replay test and is not accepted as complete E2E evidence.

## Minimum Preview-only repair scope

1. Add a narrow synthetic-order test adapter reusing existing claim/report/state functions, instead of enabling customer checkout or the payment ledger. Require isolated Preview flags, the existing test authentication, the exact Neon branch and TLS, the independent Blob Store, a fixed synthetic fixture identity and the configured test-recipient allowlist for every mutation.
2. Prepare a branch-asserted, idempotent synthetic fixture insertion for an authorized Preview SQL Console session. Do not grant Worker INSERT, use an owner connection in application runtime, reset roles, modify a real Shopify order or silently reset an existing test row. Do not request execution before the guarded test adapter is reviewable and ready.
3. Give the existing inactive integration draft a strictly bounded Preview-only test path and a verified authentication route through Deployment Protection. Do not point its legacy credential at a new host or enable any polling/recovery schedule. No such authentication route has yet been demonstrated.
4. Execute only after all preceding gates pass. Record the actual synthetic intake/order identity; PAID -> PROCESSING -> DELIVERED transitions; processing_attempts=1; Worker execution/node logs; stored/read-back XLSX; the same run's real test-email receipt; replay outcomes with no extra send or attempt; failure quarantine; and synthetic Blob cleanup. Preserve the order audit evidence instead of deleting it.

## Acceptance disposition

Full automatic order delivery: BLOCKED, not PASS and not a confirmed processing failure. Previous PDF-to-XLSX-to-test-mail execution 4659 remains a separate component acceptance. No payment, customer mail, real order, Production mutation, workflow activation or Shopify #1033 modification was performed. Production-wide Worker OFF and Shopify #1033's current state were not independently reverified by this audit.
