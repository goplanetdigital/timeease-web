# Purpose-specific payment connection continuation

Draft only; no Production configuration or deployment changes.

`productionConnection('payment')` now reads only
`TIMEEASE_PAYMENT_DATABASE_URL`. It preserves the legacy/shared
`TIMEEASE_DB_DATABASE_URL` and its existing targets. It does not fall back to
that URL, to the Worker URL, or to ambient credentials. Existing role, branch,
database and verify-full guards remain in effect.

The new focused test file verifies key selection/isolation without creating a
Pool or connecting to a database. CI retains exact-source checks for the
unchanged accepted suites and runs only these new key-boundary tests plus the
required typecheck/build. It does not rerun #6926, previous sender/HMAC suites,
Neon migrations or existing terminal fixtures.

The protected Production URL value is not exported or copied into Preview.
Dedicated URL provisioning, native role/TLS evidence from the actual release
runtime, the two outstanding Production FK targets and deployment remain
separate release blockers. Do not recreate roles or replay the earlier
migration to configure the new variable.

The inactive n8n Integration Draft now prepares `outbox_claim` and per-order
XLSX/receipt context. A hard-stop node prevents provider calls. These source
changes do not establish real HTTP/Gmail/ledger completion acceptance; the
formal business API intentionally remains closed in Preview.
