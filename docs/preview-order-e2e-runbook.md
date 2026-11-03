> Current acceptance update: 2026-11-03. The dated addendum below supersedes older “not executed” statements for the specific actions now observed. Historical design sections remain for context. This is not Production approval.

## 2026-11-03 observed acceptance and release blockers

Code under test: `6845b1045d3a8c25c5d1265c43c14a564563bb2a`.
Vercel isolated Preview: `dpl_EkibQs5vTzfYkfjb6iXM1fVPXTxB`,
`timeease-v2-secure-l5x53pixd-go-planet-digital.vercel.app`, target null, READY.
PR Safety CI run `41588636356` completed successfully. CI was read, not rerun.
The correct schema-only Neon branch is `br-restless-hill-ao5vpgb4`,
project `odd-base-63790740`; the historical shared branch is archived.
Access used an existing authorized browser session. No share link was created,
Secret exported, Deployment Protection disabled, or external Worker transport inferred.

### Actual fixed-fixture actions in this run

- Failure fixture `5b6b7ad4-3ff3-409c-a584-d47c6d77ca97` began PAID with attempts 0.
  prepare succeeded (nonce `2779512e-0947-4093-a304-a1a0b56366c3`).
  claim succeeded once (nonce `7d3354c2-d564-43ef-b185-4ba915ff5fc6`).
  The database records processing_started_at `2026-11-03T14:04:59.789Z`.
- A second claim returned workerStatus 409
  (nonce `23e59ece-693e-482a-b720-57a3eea9ee54`).
- Recovery before the real ten-minute boundary returned workerStatus 409
  (nonce `b0420dd0-51fd-413b-abad-b39c787cb67f`).
- After the real ten-minute boundary, recover returned recovered=true,
  noAutoRetry=true, emailSent=false and productionTokenUsed=false
  (nonce `45b86f65-7758-4a42-9836-9d38d6298854`).
  Another claim returned workerStatus 409
  (nonce `3afeb11c-a378-4db5-810b-a764fe1fbbd8`).
- Independent read-only SQL at `2026-11-03T14:16:21.129Z` confirmed
  REVIEW_REQUIRED, attempts=1,
  PROCESSING_TIMEOUT_MANUAL_REVIEW_NO_AUTO_RESEND, no result and no mail receipt.
- Existing delivery fixture `d7438959-82c2-4d9a-959c-b065ecc12720` was not
  reprocessed or resent. Repeated claim and delivered-with-the-recorded-receipt
  both returned workerStatus 409 (nonces `273ff372-f2c5-4b42-96f5-cfbcb4304fb1`,
  `ab685e5f-ab17-4287-94c0-0adaaa3343c1`).
  The same SQL confirmed DELIVERED, attempts=1, result present, unchanged receipt
  `1a19d542ab77c744`.
  The prior read-only Gmail audit matched that exact message ID to
  “TimeEase Preview TEST-004” and `te-test004.xlsx`; attachment bytes were not
  independently re-read in this run.
- No clock override, SQL mutation, fixture reset, payment or email send occurred.
  Synthetic Blob cleanup was not performed; retain the objects as test evidence.
  Concurrent-claim, result-upload replay and signed paid-webhook transport are
  not newly proven by these sequential browser actions.
- Responses explicitly retain externalWorkerHttpVerified=false. This browser
  operator adapter is not external n8n HTTP acceptance or full production E2E.

### Inactive n8n integration draft repair

Workflow `Zq06lp0qNiDzCdSy` remained active=false and activeVersionId=null.
Draft version `4b79e133-ed19-4db5-a0b5-2f4106990b51` now inserts:

result_ready -> reserve_delivery -> strict reservation IF -> restore XLSX -> Gmail.

Only the exact response ok=true, reservation=RESERVED, send=true and
reviewRequired=false can reach the existing Gmail path; the false output ends.
The reservation request reuses the existing report credential, has retries off,
and routes errors to the existing manual-review path. No credentials were added,
changed or disclosed. The graph read-back confirmed the sole inbound edge to
attachment restore comes from this IF, and Gmail remains downstream of restore.
Twelve local cases against the exact saved IF expression passed (including
string booleans, missing fields, ALREADY_RESERVED and NOT_RESERVABLE rejection).
These checks do not execute n8n, the report API or Gmail; integrated reservation
and mail acceptance remain required before activation.

### Production remains NO-GO

Read-only observations, not permission to change Production:

1. Main Neon branch `br-wispy-river-aoo9eown` returned no role named
   `timeease_worker_limited`. The isolated Preview branch has the role with
   LOGIN=true, no elevated privileges and no neon_superuser membership.
2. Project `timeease` environment-variable metadata has no
   `TIMEEASE_WORKER_DATABASE_URL`. Values of database URLs and Secrets were
   neither decrypted nor inspected. The new worker connection guard requires
   the limited role, so do not merge and hope the existing ledger URL suffices.
3. Existing Production /api/readiness reports checkoutEnabled=true and
   workerDeliveryVerified=true, but launchReady=false and
   paymentWebhookVerified=false. These switches predate this run and were not
   changed. They are not evidence that an active Worker is delivering orders.
4. The connected Shopify app returned zero shop-scoped API webhook subscriptions.
   This query cannot enumerate another app's, TOML-configured or manual Admin
   webhook settings; real paid-webhook destination/signature/replay evidence
   remains unverified. No subscription or payment configuration was changed.
5. The patched n8n workflow is an unpublished inactive draft, and its production
   endpoint and credential cannot be used as isolated Preview proof.

Minimal release order for a separately authorized Production change:
provision/audit the limited Worker role and bind a dedicated Worker connection;
verify the actual Shopify paid-webhook mapping and signature/binding evidence;
exercise the reservation-aware Worker in an isolated transport with one send and
replay/failure evidence; review schema and rollback against the exact release
commit; then stage/deploy and activate only after approval. Do not enable or
re-attest checkout/delivery flags merely to remove blockers. PR #20 stays Draft
and unmerged. Keep Worker OFF and Shopify #1033 REVIEW_REQUIRED, without rerun.
Rollback must stop Worker intake first, preserve receipts/reservations and reviewed
orders, and use the previously verified application deployment; never reset order
states or automatically resend ambiguous email.

---

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
