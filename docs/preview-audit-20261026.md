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
1. The legacy-role REVOKE approach is superseded. The updated preview-worker-permissions.sql creates only timeease_worker_limited with NOLOGIN and narrow SELECT/column UPDATE privileges on this Preview branch. It leaves timeease_test_worker untouched. If the new role already exists, the script stops. On failure inspect the error and transaction state before retrying. After permissions are independently verified, the operator must set a new dedicated login credential privately and update only this PR branch Preview TIMEEASE_DB_DATABASE_URL. No existing secret is retrieved, reused, or reset.
2. From an already authorized Preview client with its existing test-worker authorization, request /api/test-worker/db-identity and retain the JSON evidence. Do not paste any secret into chat. Do not disable Vercel protection.
3. Confirm an existing isolated Blob/Worker/mail test setup before any E2E. No shared Production storage writes, genuine payments or customer emails are permitted.

PDF → Excel, Blob, mail, order E2E remain BLOCKED until these isolation checks pass. Shopify #1033 must remain REVIEW_REQUIRED; no Production delivery may be enabled by this PR.

## Follow-up: protected Neon role membership
- User SQL Editor confirmed neondb_owner on the exact Preview branch with read_only=off.
- The prior DO block failed at REVOKE neon_superuser with SQLSTATE 42501. Subsequent independent SELECT confirms the old role retains elevated flags and timeease_worker_limited is absent.
- Neon official roles docs require SQL-created roles for limited privileges: https://neon.com/docs/manage/roles . Do not create the replacement via Console Add role or API, which assigns neon_superuser membership.
- Diagnostic now accepts only timeease_worker_limited. Legacy connection strings fail before opening any connection. No credential or role has been created by the agent. The operator creation script deliberately uses NOLOGIN; login/credential setup follows after permission validation.
- Earlier Preview deployment a848868 was READY at dpl_GraJctPm6Z4Nq1B8Fgh9KkUfUbZv; deployed application JSON/TLS remains blocked by protection and application authentication.
- QuoteFlow branch-specific DATABASE_URL was subsequently corrected by the operator; dpl_FN2x14T1tERs3xUXY1SgKdPhGuxT at commit 249a381 returned isolated=true with all four query identity checks true. It uses Neon HTTPS and does not attest native PostgreSQL TLS.

## Follow-up: shared Blob access closed in Preview

- Confirmed f0c2407 deployment dpl_CHKVYi7mkCj9hu8dxBwmnCr9uooE is READY, Preview target null, exact PR20 ref/SHA; PR remains Draft.
- DATABASE_URL variable metadata is Preview-only. No secret decrypted or copied.
- Read-only query authenticated as timeease_worker_limited returned neondb, odd-base-63790740, br-rough-butterfly-aox5mukp and order_count=0. This is connector evidence, not application-native TLS evidence.
- BLOB_READ_WRITE_TOKEN metadata points to store_2zPRAZaFbo6bhEfz and one variable scoped to production, preview and development. Storage isolation FAIL; no Blob requests performed.
- Found intake could upload despite checkout being off; checkout could read manifests before its checkout gate. All seven Blob-facing handlers now reject Preview before parsing a body, reading storage, opening a database connection or invoking Shopify. No configuration flag can bypass the temporary block. Production/development request behavior remains unchanged. A later reviewed change may lift the block only after a separate existing Preview store and runtime isolation are verified.
- Runtime diagnostic remains BLOCKED by deployment_authentication_required after the connector's authenticated-share redirect. Existing worker has no Preview credential mapping; no Production credential reused. Recent Preview runtime-log query returned no entries, which is not TLS/API acceptance.
- V2 integration draft Zq06lp0qNiDzCdSy remains inactive. No workflow activated or executed, no orders changed, no mail sent. Shopify #1033 was not modified or independently revalidated.

## Store metadata and readiness follow-up

Read-only store metadata confirms store_2zPRAZaFbo6bhEfz (timeease-v2-secure-storage-20261013) is connected to timeease-v2-secure in production, preview and development. No tokens requested or displayed. A separate existing Preview store has not been identified; no store created.

The authenticated connector retrieved real /api/readiness JSON from 74566c8. Its intakeEnabled=true contradicted the new Preview gate. Readiness now reports intakeEnabled=false and previewBlobAccessBlocked=true in Preview with the inherited token. No connection details or secrets are returned. The database diagnostic endpoint still failed through the connector's protected-deployment path; readiness reachability does not establish diagnostic authorization or native TLS.
