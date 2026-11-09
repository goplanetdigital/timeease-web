# V2 delivery Outbox: isolated Preview implementation and approval gates

Scope: existing Draft PR20 branch only. The five accepted terminal synthetic
orders are immutable evidence: do not reset, claim, publish, resend or clean them.
No mail, real payment, Production Worker, Production database or PR merge.

## Observed gap and minimal plan

On 2026-11-07 the isolated branch br-restless-hill-ao5vpgb4 in project
odd-base-63790740 / neondb has empty fulfillment_outbox, delivery_ledger and
paid_intake_claims tables. Both delivery-table FKs still reference legacy
paid_intake_claims. V2 orders are stored in timeease_v2_orders. The limited Worker
has no SELECT/INSERT/UPDATE privileges on either delivery table.

Preserve the two existing tables, columns, primary keys, unique order/intake/type
and receipt constraints. Propose changing only their two intake FKs to V2 orders
on this empty isolated branch, then grant SELECT/INSERT and UPDATE of mutable
state columns to the existing limited Worker. No DELETE/TRUNCATE, immutable-ID
updates, V2 INSERT or role credentials. Do not manufacture legacy line-item IDs
or manually insert fake Outbox records to satisfy the old FKs.

Reviewable SQL: preview-v2-outbox-schema.sql and preview-v2-outbox-fixtures.sql.
Both refuse any other project, branch, database or operator role. Schema SQL
requires all three legacy/delivery tables to be empty and expected legacy FKs.
It is not a build migration and is not automatically executed.

Changing constraints and granting new table access needs explicit operator
approval before execution. The current task authorizes code and local tests;
it does not silently approve a destructive ALTER or broadened database access.

## Transaction boundaries and actual integration point

This Outbox is for **result delivery**, enqueued after a durable XLSX exists;
it is not an assertion that payment intake now creates fulfillment jobs.

lib/v2-delivery-outbox.ts uses only the transaction client supplied by the
already isolated Preview adapter. There is no ambient Pool or network sender.
Every path locks V2 order first, then its fixed Outbox and Ledger rows in the
same order. The adapter owns BEGIN/COMMIT/ROLLBACK.

1. Result publishing: existing Blob store/readback succeeds first; shared
   markResultReady + actual Outbox PENDING + actual Ledger PENDING are committed
   together. Any SQL failure rolls back all three database changes. A Blob written
   before SQL rollback remains evidence; no overwrite or automatic cleanup.
2. Replay: validate existing queue/order binding and return IDEMPOTENT without
   resetting delivery UUID, statuses, counters, lease or receipts.
3. Claim: Outbox PROCESSING/attempt=1/ten-minute lease + Ledger SENDING/attempt=1
   + V2 durable reservation marker in one transaction. IN_FLIGHT/reviewed/failed
   rows never receive a new send authorization or reset.
4. Known no-send failure: Outbox FAILED + Ledger FAILED + V2 REVIEW_REQUIRED.
   Expired/ambiguous lease: Outbox FAILED + Ledger UNKNOWN + V2 REVIEW_REQUIRED.
   Neither path requeues. Lease expiry uses real PostgreSQL now(), no API override.
5. Trusted receipt completion: V2 DELIVERED + Outbox DELIVERED + Ledger SENT in
   one transaction. Same receipt is idempotent; a different/duplicate receipt is
   rejected and rolled back. This function has NO public Preview completion
   action, and local synthetic receipts must never be used as Neon evidence.

Ordinary Production payment/report/result routes and existing shared functions
are unchanged. This Preview implementation is a reusable transaction module;
Production wiring and migration remain a separate future release task.

## Exact new no-mail cases (not seeded)

| case | ID |
| --- | --- |
| outbox_persist | b8f0b839-e0ff-4ef5-bf90-c32513c83fbf |
| outbox_failure | 712fb48a-03e8-470f-82fe-e8a5dbe12b7e |
| outbox_timeout | 52c899ce-3ea0-4d03-b9df-7e5ae2d83d99 |

Exact order reference: preview-pr20-outbox-20261107:<case>:<id>. Also require
preview.invalid, synthetic-invoice, synthetic USD1, jcaiworker@gmail.com and
the exact per-ID source manifest. Caller cannot choose IDs, recipient, path,
delivery UUID, credential, timestamp or lease. Old five cases cannot call
outbox actions. New cases cannot call delivered, cleanup, old reserve/recovery
or general review actions. No endpoint sends email; responses force send=false.

The adapter calls read-only schema/permission preflight before touching these
fixtures or writing Blob. Wrong legacy FKs -> OUTBOX_SCHEMA_NOT_READY; absent
minimal grants -> OUTBOX_ROLE_NOT_READY. No runtime repair or owner fallback.

## Validation performed and its limits

New SQL tests run the actual shared functions against PGlite PostgreSQL, not an
in-memory SQL mock. Verified result/queue/ledger persistence across close/reopen,
all-or-nothing rollback after a real ledger trigger error, enqueue idempotency,
one-attempt lease, known no-send failure, expired-state recovery, and atomic
local receipt completion/replay/uniqueness. PGlite is single-backend: these tests
are not multi-session concurrency evidence or Neon acceptance. The expired lease
is a LOCAL SQL fixture; no Neon clock or timestamp was changed. Synthetic local
receipts prove SQL behavior only; no email or external provider receipt exists.

Five new Preview guard tests cover exact bindings, old-case exclusion, no mail/
cleanup/time overrides, environment/auth boundary and safe schema/role failures.
Previously accepted claim/reservation/recovery tests were not manually rerun.

## Remaining Neon acceptance (BLOCKED until approval)

1. Approve/recheck the exact schema/grants SQL; compare old five full-row snapshots.
2. Once schema and credential transport are ready, separately approve the exact
   three-row seed; never rerun an existing fixture or write Outbox/Ledger directly.
3. For each new row: prepare/claim/store a valid synthetic XLSX through the actual
   Preview adapter. Read back one Outbox and one Ledger row plus durable V2 result.
4. Replay outbox_enqueue and claim: counters/UUID/rows unchanged, no second lease.
5. Known failure on outbox_failure -> FAILED/FAILED/REVIEW_REQUIRED, repeat denied.
6. On outbox_timeout, reject early recovery, wait real ten minutes, then verify
   FAILED/UNKNOWN/REVIEW_REQUIRED and no retry. Do not shorten the lease in Neon.
7. Verify all five previous orders unchanged, no new receipts or email, workflow
   inactive/unpublished, PR Draft. No cleanup in this run.

Until these run, Outbox NEON persistence/idempotency/recovery remain BLOCKED.
No-mail testing cannot prove actual SENT delivery or exactly-once email delivery.

## Rollback

Before seeding: separately approved schema rollback can restore the two old FKs
and revoke exactly the new grants while both tables remain empty. After evidence
rows exist: revert/disable the Preview code path while retaining schema, leases,
receipts and audit rows. Never delete audit data to make a down-migration pass,
and never requeue REVIEW_REQUIRED/UNKNOWN records.
