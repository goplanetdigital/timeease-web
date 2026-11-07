# PR20 Preview sender-boundary continuation

Parent accepted commit: 3fcda0a30bb13e3f07e1ae65d656fc1ee2c38051.
This change fixes the next sender integration gap; it does not rerun the
accepted Preview Outbox persistence, concurrent claim or real-time lease tests.

## New contract

Formal `outbox_claim` now returns the exact locked `intakeId`, `deliveryId` and
PostgreSQL `leaseUntil`. A missing lease aborts the transaction rather than
returning send authorization. `delivered` requires string-valued IDs/receipts.
The existing Outbox SQL module and synthetic adapter remain unchanged.

`lib/n8n-outbox-contract.mjs` provides pure sender/receipt/monitor boundaries:

- Require exactly one current item, with the same paid-order ID, attachment
  order ID and fixed result path. No cross-order `.first()` lookup is used.
- Require actual HTTP 200, parsed JSON, ok/send true, CLAIMED, bound intake and
  delivery UUID. Redirects, HTML, duplicate/in-flight or uncertain responses stop.
- Require a valid SQL lease with 30 seconds of remaining headroom and no more
  than ten minutes remaining. Delayed/expired items must not reach Gmail.
- Carry that approved context through the matching per-item Gmail operation;
  construct the report only with the real string-valued Gmail API ID and the
  same server delivery UUID. These functions do not send or verify inbox delivery.
- Parse Outbox FAILED, Ledger UNKNOWN and expired-lease counters. An unreachable
  or malformed monitor is an error, not a zero-exceptions result.

The time check is a pre-send boundary, not a distributed cancellation guarantee.
A provider call already in flight can still finish after a reversal/expiry; retain
UNKNOWN/manual reconciliation and never automatically resend.

## New isolated n8n acceptance

Workflow `wFi7i6QqkOZmJFNl`, **TimeEase PR20 Preview Sender Contract - No I/O**,
created in Jade Cheng's personal project (`zCKVEfMJcLmG1rRQ`), project root.
It has only a manual trigger and a JavaScript Code node. No credentials, HTTP,
database, file I/O, Gmail, schedule, execute-workflow or Worker nodes exist.
It stays inactive and unpublished. Existing V2/legacy workflows were not edited.

SDK: `workflows/preview-outbox-contract.sdk.js`, generated from the shared contract
by `scripts/build-n8n-preview-contract.mjs`; SDK validation PASS, two nodes.
Pinned manual-input test execution **#6812**: **PASS, 14 checks**,
`simulationOnly=true`, `send=false`, `noEmailSent=true`, networkCalls=0,
databaseWrites=0, receiptIsSynthetic=true. UUIDs and receipt values are in-memory
examples only, never inserted into Neon or used to mark an order delivered.

This proves n8n sender-boundary logic, **not** actual HTTP transport, Neon writes,
Gmail delivery or the formal API provider-receipt E2E. Prior Stripe read-only and
Preview Outbox PASS evidence is reused, not relabelled as new acceptance.

## Verification and remaining gates

New targeted checks cover the sender guard, receipt correlation, monitoring shape
and formal response's SQL lease binding. Typecheck/build run on this change. CI
reuses unchanged app/payment/release guards from 3fcda0a, and unchanged Preview
core/adapter from 4e656ac. Only the changed formal delivery-response regression
and new lease/contract checks execute; no old terminal fixture is touched.

Still blocked before charging/activation:

1. Actual Shopify paid/reversal webhook targets and delivery history; legacy
   published Intake/Upload/Batch retirement and a single-route cutover.
2. Separate approval of proposed Production migration, two limited login/secret
   provisions and exact release configuration. None is executed in Preview.
3. A reviewed inactive sender/recovery/monitor release version using this contract,
   approved new isolated fixtures for the missing formal integration, and explicit
   permission for any fixed-test-mailbox provider-receipt test. Do not resend any
   terminal fixture or repeat the already-passed standalone Gmail attachment test.
4. Explicit Production deployment/flags/Worker authorization only after those
   gates pass. PR20 remains Draft; no Production or existing order changes.
