# Issue #21 / Draft PR #20 continuation evidence

Recorded 2026-11-06 (Asia/Kuala_Lumpur). External authenticated Preview
acceptance and full delivery E2E remain **BLOCKED**. Deployment READY and an
opening website do not establish protected API authentication.

## Recovery from the deleted environment

- Read the remote refs, public PR #20 conversation and Issue #21 before editing.
  PR #20 was Draft. Its remote branch
  `feature/isolated-worker-diagnostics-20261026` and PR head both resolved to
  `80f4b80a62e36fb31dcdeccdcabeea26f74654fe`.
- `f442551` was not available as an object in this checkout after fetching the
  PR branch. Its exact patch cannot be recovered or inferred from its short SHA.
- The auth-check route and auth-channel tests already exist in `b1b1da2`;
  the order adapter/tests already exist in `26ec4bc` and later commits.
  They were retained without recreating or cherry-picking duplicate changes.
- This continuation-readiness document was absent. It is reconstructed evidence,
  not a claim to have recovered the exact deleted local commit.

## Current local evidence

Using the existing checkout at `/workspace/timeease-web`, Node 24.22.1 and npm
11.9.0, with no application secrets or database connection configured:

- `npm install --package-lock=false --no-audit --no-fund` completed; no lockfile
  or dependency declaration was changed.
- `node --test tests/*.test.mjs` returned success with 10 file-level passes,
  zero failures/skips. A focused TAP invocation reported two file-level passes
  for the auth-channel and order-adapter files. These counts do not re-establish
  the previous environment's reported 30 individual test cases.
- `npx --no-install tsc --noEmit --incremental false` passed.
- `NEXT_TELEMETRY_DISABLED=1 npm run build` passed, including 40 generated pages.
- The built app started with `npm run start -- --hostname 127.0.0.1 --port 3000`.
  Local GET `/` returned 200 with TimeEase content; GET
  `/api/test-worker/order-e2e` returned 404 `PREVIEW_TEST_ONLY`, and GET
  `/preview-worker-auth-check` returned 404 outside Preview configuration.
  These verify local startup and closed gates, not Vercel Protection or live E2E.
- Next generated a change to `next-env.d.ts` during build; restore only that
  generated change before committing. Keep application source and tests intact.

No further previously passed component tests or historical runtime acceptance
cases need rerunning merely because the environment was replaced.

## Isolated database reconciliation

Current executable guards (`lib/test-worker-guards.ts`), fixture SQL and limited
role permission SQL agree on project `odd-base-63790740`, database `neondb`,
schema-only branch `br-restless-hill-ao5vpgb4`, role
`timeease_worker_limited`. Branch `br-rough-butterfly-aox5mukp` and endpoint
`ep-summer-salad-aoeax66z` in older audits are historical, not current targets.
The retired endpoint is rejected before a connection; queried branch/project,
role attributes and authorized TLS are checked before synthetic mutations.

Do not construct a real endpoint name from a branch ID or copy the synthetic
URL in unit tests. Resolve the actual branch endpoint through approved Neon
metadata. This session had no Neon integration or database binding, so actual
deployment connection, SQL role privileges and client TLS were not re-attested.
Do not rerun role creation or fixture insertion against existing evidence rows.

## Protected Preview and n8n double authentication

The user independently verified deployment
`dpl_F2gPEtrCG17yK1kx98M679NA95Ap` READY with an opening frontend. Its exact
hostname, commit and protected API responses were not independently available
in this session. Do not substitute an older hostname from the PR description.

The remaining transport must satisfy two separate existing authorization layers:
Vercel Deployment Protection and the application's Preview Worker Bearer.
An authenticated page GET does not prove an authenticated API POST. The fixed
browser auth-check form delegates Bearer verification in-process and explicitly
returns `externalWorkerHttpVerified=false`; it cannot establish n8n HTTP access.

Before changing workflow `Zq06lp0qNiDzCdSy`, read its current revision and ensure
`active=false`, `activeVersionId=null`. Inspect the actual failing node and
sanitized response from execution #6396 without re-executing it. Only the inactive
isolated manual path may be repaired. Use the verified unique Preview hostname
and approved existing credential references. Keep application Bearer auth and
Protection auth separate; never overwrite one with another Authorization header,
copy browser cookies, export secrets, follow SSO redirects as success, disable
Protection, repoint the Production chain, or activate a schedule. Preserve the
existing delivery reservation and manual-review branches. No live graph was
accessible, so the exact double-auth defect is not yet diagnosed or fixed.

## Duplicate handling and missing safe E2E

Repository inspection confirms the V2 ledger has unique intake/order keys;
`recordVerifiedPayment` uses `ON CONFLICT DO NOTHING`, checks the complete binding
and returns `ALREADY_RECORDED` only for a matching order. Claim uses a conditional
atomic update; delivery reservation and uncertain receipts stop for manual
review. This is source evidence, not proof of legacy active n8n intake behavior.

The active legacy workflow's current published graph, trigger destinations,
order/event deduplication keys, retries and downstream send gates require a
read-only audit. Do not edit, activate, or execute it. Do not conclude that all
Production automation is off from the V2 draft being inactive.

The November 3 addendum in `preview-order-e2e-runbook.md` already records real
timeout quarantine and terminal replay checks, and a prior delivery receipt.
Retain those results and terminal fixtures; do not reset, resend or replay them.
No new external E2E was run here. Remaining evidence includes external protected
Worker transport, integrated reservation/conversion/test-mail acceptance,
concurrent claim and result-upload replay. First inspect current fixture state
read-only. If terminal fixtures prevent a missing case, prepare a separately
reviewable isolated fixture change rather than reopening old orders.

## Exact access needed to unblock

1. Vercel integration access to resolve the exact deployment hostname/commit and
   protection metadata; an approved runner capable of protected GET/POST with
   existing Preview Protection authorization and `TIMEEASE_TEST_WORKER_SECRET`
   supplied securely through its approved binding. No secret export is required.
2. Read-only Neon metadata/SQL access to the schema-only branch above, and
   deployment-side diagnostics using the existing limited login to attest actual
   identity and verified client TLS. Do not grant Worker INSERT or owner access.
3. n8n integration access to read the inactive draft/current execution metadata,
   update only its isolated test path, and inspect published legacy intake
   metadata read-only. Its service hostname is not known in this environment.
4. For a missing delivery test only: existing approved synthetic PDF-to-XLSX and
   test-mail credential references, with independent receipt/attachment read-back
   for the fixed test mailbox. Never send real customer email.

Environment status reported no secrets, runtime variables or outbound identities.
Variable-name inspection found GitHub authentication but no Vercel/Neon/n8n
bindings. Native Git read worked; GitHub GraphQL returned Forbidden and REST
CONNECT returned 403. Public GitHub pages remained readable. API access needs
both the appropriate network destination and scoped authorization; working Git
access alone proves neither. Required destinations include `api.github.com`,
`api.vercel.com`, the verified Preview hostname, approved Neon API/endpoint and
the actual n8n host. Do not allow broad wildcards or guess missing service hosts.
Restore approved integrations/bindings in environment settings; never enter
secrets in chat. No credential requirements or network policy were broadened
as a substitute for unavailable integrations.

## Rollback and retained limits

This recovery changes documentation only; revert its commit to remove it.
No Production configuration, workflow, payment, real order, email or database
state changed. Shopify #1033 was not queried or rerun. Protection remains enabled;
no PR status change or merge was requested. Keep PR #20 Draft and unmerged.
For any later isolated workflow repair, retain its prior revision, keep it
inactive, and restore that revision on failure without resetting fixture state,
delivery reservations or receipts. External E2E remains BLOCKED until the missing
access and actual evidence above are supplied.
