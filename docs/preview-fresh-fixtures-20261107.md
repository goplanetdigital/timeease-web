# Preview fixed fixtures: PR20 acceptance extension

Only the isolated PR branch and exact deployment hostname are accepted. Keep
Production, ordinary customer routes, Worker activation and PR merge out of scope.

The operator already seeded these three rows in Neon project odd-base-63790740,
branch br-restless-hill-ao5vpgb4, database neondb. Do not run the seed again.
All started PAID, attempts=0, no result/receipt. The two legacy terminal rows
were compared in full before and after the seed and were unchanged.

| case | exact intake ID | exact synthetic order reference |
| --- | --- | --- |
| race | 29a22afd-a1d7-47d2-b97b-03d2a3eaa0c8 | preview-pr20-20261106-r1:race:29a22afd-a1d7-47d2-b97b-03d2a3eaa0c8 |
| reservation | 37a129e0-e879-4f6a-b306-3c112afd3d5a | preview-pr20-20261106-r1:reservation:37a129e0-e879-4f6a-b306-3c112afd3d5a |
| delivery_v2 | 6b2322d8-c7a0-45ff-9ab3-082e2684a067 | preview-pr20-20261106-r1:delivery:6b2322d8-c7a0-45ff-9ab3-082e2684a067 |

All bindings also require preview.invalid, synthetic-invoice, amount_usd=1,
jcaiworker@gmail.com and the exact per-ID manifest path. Synthetic PAID / USD1
is state-machine input, not a real payment or revenue.

## Minimal implementation boundary

- Retain legacy delivery/failure IDs and behavior.
- New cases are explicit own-properties of a fixed map; no arbitrary IDs,
  caller-selected recipients, paths, targets, credentials or clock overrides.
- Shared claim/result/reservation functions use the verified, locked transaction
  client. No ambient database, schema, INSERT privileges or production code change.
- New cases reject delivered and cleanup before database access. Only reservation
  accepts result and reserve_delivery. Reserve returns send=false,
  noEmailSent=true, outboxVerified=false even when it records RESERVED.
- Scoped recovery accepts only legacy failure and new race/delivery_v2, and
  requires the actual existing ten-minute processing age. No requeue or resend.
- The browser Console remains limited to its existing two cases. Use the external
  JSON test endpoint with the existing approved dual-auth credential.

## Runtime acceptance still required

1. Verify the exact new Preview deployment and bind its exact hostname through
   the existing secure credential allow-list. Do not broaden to a wildcard or
   print/export credentials. Authentication #6607 is already PASS; do not rerun it.
2. status all three new cases, checking the seeded pristine rows; prepare sources.
3. Two genuinely overlapping external claim requests for race: one 200 CLAIMED,
   one 409, with attempts=1 on independent SQL readback. Sequential replays are
   not concurrency evidence. This adapter serializes by row lock; do not claim
   the unwrapped ordinary Worker HTTP path has thereby passed.
4. reservation: claim, upload an actual valid synthetic XLSX, readback, reserve,
   independent status/SQL readback of DELIVERY_RESERVED_NO_AUTO_RESEND, repeat
   reservation and verify REVIEW_REQUIRED with no email and no extra attempt.
5. delivery_v2: claim, recover before age boundary -> 409, recover after real
   ten minutes -> REVIEW_REQUIRED, attempts=1, no result/receipt. No time override.
6. Independent final readback: legacy rows identical, no email receipts or Outbox
   claims fabricated, Worker inactive/unpublished. Do not clean up objects.

## Separate Outbox gap

V2 reserveDelivery persists a marker in timeease_v2_orders.last_error. It does
not write timeease_fulfillment_outbox or timeease_delivery_ledger. Those tables
reference timeease_paid_intake_claims, not V2 orders. Producer mapping, atomic
enqueue, lease/consumer and receipt/status integration are not established for
this path. No grants or manual Outbox inserts are added. Keep Outbox BLOCKED.

Local new-case security checks use mocked IO and are not runtime acceptance.
