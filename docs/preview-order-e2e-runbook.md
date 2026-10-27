# Preview synthetic order adapter and remaining acceptance gates

This change adds a bounded test path; it does not enable customer checkout,
Shopify intake, Production Workers or the ordinary Preview business routes.
Do not treat the adapter's local security tests as a completed delivery E2E.

## Request attribution and minimal repair

An authenticated GET to the exact deployment hostname
`timeease-v2-secure-oebj9p04r-go-planet-digital.vercel.app/api/worker/manifest?intakeId=d7438959-82c2-4d9a-959c-b065ecc12720`
returned 503 `PREVIEW_BLOB_ISOLATION_REQUIRED`, request ID
`sin1:iad1::iad1::nvnld-1793072240703-3ad397480d5b` on 2026-10-27.
Vercel associates that hostname with Preview deployment
`dpl_BvSsmxWhiDgWCsiuMi2Zof4zEp51`, branch
`feature/isolated-worker-diagnostics-20261026`, runtime commit `4cbb2e5`.
The same deployment's readiness JSON reports `configuration.preview=true`.
This was an actual GET handler, not a substituted POST acceptance test.

The upload components use same-origin `/api/intake`; there are no configured
Next.js rewrites or middleware forwarding that call to Production. Production
URLs in layout/SEO metadata are not the upload transport. Subscription checkout
is a separate payment path and must not be invoked in this test.
The inactive n8n full-order chain still points to `timeease-ruby.vercel.app`;
it must not be executed as the Preview chain.

The 503 is the deliberate unconditional Preview business guard, not incorrect
environment detection or evidence that the independent Blob Store failed.
The guard remains intact. The new `/api/test-worker/order-e2e` adapter bypasses
none of the existing business handlers; it uses an independent synthetic-only
authorization and fixture scope and reuses the real state transition functions.

## Runtime contract

GET `/api/test-worker/order-e2e` is side-effect free and reports the exact runtime
environment, Git branch, commit and deployment hostname. It is 404 outside the
isolated Preview branch or when accessed through another hostname. Vercel
Deployment Protection continues to apply. It does not authorize POST or disclose
secrets, order rows or object contents.

POST requires BOTH existing Deployment Protection authorization and the existing
Preview `TIMEEASE_TEST_WORKER_SECRET` bearer. No production-secret fallback.
Use the newly verified unique deployment hostname, not an alias or Production.
JSON body: `{"action":"status","case":"delivery"}`. Case is `delivery` or
`failure`; no caller-specified IDs, paths, tokens, order IDs or recipients.

The adapter checks isolated Preview flags with checkout/ledger both OFF, exact
branch/hostname, the existing configured test recipient, actual Neon identity,
client certificate/TLS, least privilege, fixed immutable fixture binding, and
the explicit independent Store via OIDC. It locks the exact fixture row and
passes that transaction client into the existing state functions. Default
production call sites retain the same function behavior.

## Required capabilities; current connector limitation

1. An already-authorized isolated runner must support HTTPS POST, JSON, bounded
   binary/base64 data and the two existing authentication layers. Existing test
   authentication must be supplied through that runner's approved credential
   mechanism; never print, copy/export/recreate a Secret or copy browser cookies.
   Vercel's connected fetch tool accepts only `url` (GET), so it cannot run these
   POSTs. Do not put credentials in URLs, use GET for mutations, or disable
   Deployment Protection. No such runner is currently verified.
2. An authorized Preview SQL Console session may insert the two reviewed fixtures
   using `docs/preview-order-e2e-fixtures.sql`. Current Neon connector transactions
   are read-only and the Worker intentionally has no INSERT privilege. Never
   change those permissions or `transaction_read_only` to work around this.
   The SQL is prepared but NOT executed. Do not seed until POST transport is ready.
3. The existing inactive n8n integration draft must run only a reviewed bounded
   Preview path using this contract. Its old Production URLs/credential must
   not be reused, schedules must remain inactive, and all mail must target only
   `jcaiworker@gmail.com`. No workflow activation or n8n graph change is part of
   this code patch. Conversion and mail adapters must not be mocked for acceptance.

## Acceptance sequence (not yet executed)

| Step | POST action / external work | Required actual evidence |
| --- | --- | --- |
| Fixture | Reviewed SQL, delivery and failure cases | Exact synthetic IDs and initial PAID, attempts=0; no real payment |
| Source | `prepare` | Two fixed synthetic PDF/manifest objects in independent Store |
| Claim | Two concurrent `claim` requests | One 200 CLAIMED, one 409; attempts=1 |
| Extract | `source`, existing n8n PDF extraction and Excel conversion | Actual TEST-004 PDF bytes, invoice fields, Excel attachment |
| Store | `result` with `xlsxBase64` from that conversion | 201, readBackVerified=true, durable result_path |
| Deliver | Existing Gmail test path, then `delivered` with its actual `messageId` | Same run's actual test email, attachment and provider receipt |
| Final | `status` | DELIVERED, attempts=1, exact result and same email receipt |
| Replay | Repeat claim/result/delivered; do not invoke mail after failed claim | 409, unchanged state/attempts/receipt, no additional email |
| Failure | failure case: prepare, claim, review, repeat claim | REVIEW_REQUIRED, one attempt, no automatic retry/send |
| Cleanup | `cleanup` for both final-state cases | Exact three fixture paths removed; namespace listings empty |

The result action stores/read-compares the XLSX before calling markResultReady.
The delivered action records a receipt provided by the authenticated test Worker;
it cannot independently query Gmail. Therefore its response explicitly says
`providerReceiptRequiresExternalVerification=true`. Acceptance must independently
match the actual mailbox receipt/attachment; invented or previous-run receipts
do not satisfy delivery acceptance. Do not reuse message ID from execution 4659.

The adapter never sends mail, pays, inserts/deletes orders, changes permissions,
requeues reviewed orders, or resets an old fixture. Cleanup removes only fixed
synthetic Blob paths after a terminal state and retains order audit rows.
An uncertain email outcome must remain for manual review rather than a resend.

## State and safety limits retained

PAID -> PROCESSING is atomic; result is recorded only during PROCESSING;
DELIVERED requires a durable result and receipt. Existing production recovery
quarantines stale processing to REVIEW_REQUIRED without resend. This patch does
not call broad recovery from the test adapter. Neither code checks nor mocks
prove exactly-once email delivery or operational recovery.

PR #20 must remain Draft. Production and Shopify #1033 are out of scope.
Previous database/TLS/Blob/component-test PASS evidence remains valid; complete
order delivery is BLOCKED until the actual sequence above is executed and audited.
