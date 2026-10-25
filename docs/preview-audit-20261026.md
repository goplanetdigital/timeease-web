# Preview audit — 2026-10-26 MYT

PR #20 remains Draft. No Production configuration, orders, workers or secrets changed.

## Evidence
- Initial head a9fd0c54035896f49bb2a6c184418717634004b3; deployment dpl_3kRJqpJ7ZUzusRD4YjXLfmuV5MKB READY and matches the PR branch.
- Neon confirms non-default branch br-rough-butterfly-aox5mukp / project odd-base-63790740 and endpoint ep-summer-salad-aoeax66z.
- SQL login as timeease_test_worker confirms this role and branch, but rolcreatedb=true, rolcreaterole=true, rolbypassrls=true, neon_superuser MEMBER=true. All four public tables allow DELETE.
- Atomic permission repair was rejected with `cannot execute REVOKE ROLE in a read-only transaction`. Follow-up SELECT confirms privileges remain unchanged. No role was created or password changed.
- Vercel protected fetch failed with deployment_authentication_required after redirect. No authenticated Vercel CLI is installed. Application-authenticated JSON/TLS attestation is still blocked. Existing test secret was never retrieved or copied.
- Local: 7 tests pass; TypeScript and Next.js build pass. Existing CSS and dynamic sitemap warnings are nonfatal.
- n8n TimeEase V2 Worker - Integration Draft (Zq06lp0qNiDzCdSy) active=false. Several legacy Live workflows are active=true; this task does not alter them or claim all Production automation is off.
- Query for order identifier 1033 in this Preview branch returned no rows; this does not prove the Shopify order state. Shopify #1033 was not changed.
- BLOB_READ_WRITE_TOKEN metadata applies to Production, Preview and Development, pointing to one store. Blob E2E cannot claim storage isolation on that evidence.

## Repairs
Authenticated diagnostic checks actual queried Neon branch/project, rejects elevated role flags, neon_superuser inheritance and forbidden INSERT/DELETE/TRUNCATE privileges, as well as requiring SELECT and verified native PostgreSQL TLS. CI runs behavioral identity security tests.

## Minimum operator actions
1. Use a write-capable Neon admin connection to the exact Preview branch to apply the reviewed permission repair in preview-worker-permissions.sql. The connection tool used here is read-only. Do not rerun CREATE ROLE or reset a password. If SQL fails, inspect the error and transaction state first.
2. From an already authorized Preview client with its existing test-worker authorization, request /api/test-worker/db-identity and retain the JSON evidence. Do not paste any secret into chat. Do not disable Vercel protection.
3. Confirm an existing isolated Blob/Worker/mail test setup before any E2E. No shared Production storage writes, genuine payments or customer emails are permitted.

PDF → Excel, Blob, mail, order E2E remain BLOCKED until these isolation checks pass. Shopify #1033 must remain REVIEW_REQUIRED; no Production delivery may be enabled by this PR.
