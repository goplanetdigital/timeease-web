# Preview-only authentication probe: local proposal awaiting approval

Base: PR #20, commit 26ec4bc933e241fd006fe16174a6fc25280f5de9.
Not committed, pushed, deployed or executed against the live Preview.

## Existing credential availability (read-only evidence)

- Vercel metadata binds the existing sensitive TIMEEASE_TEST_WORKER_SECRET only
  to Preview. Its value was not requested or retrieved.
- The already accepted actual application 401 UNAUTHORIZED, together with the
  route's TEST_AUTH_MISSING check, shows that the current Preview runtime can
  resolve a sufficiently configured test credential. This is not evidence that
  GitHub Actions or n8n may retrieve/export that value.
- Existing Actions have no authenticated remote POST step or credential binding.
  The current local execution environment has no authorized CLI or credential
  injection. The n8n integration draft still uses legacy target/credential refs.
- Do not add a GitHub Actions Secret, copy a production credential, export a
  Vercel environment value, forward browser cookies or change permissions.

## Minimum proposed implementation

1. Add auth_check to the existing fixed Preview API. It retains all existing
   environment and Bearer checks, then returns before reading a database URL,
   creating a Pool, accessing Blob, querying orders or invoking state functions.
   A public UUID nonce only correlates the request/response; it is not a new
   credential or a persistent Secret. Existing status is unsuitable for phase
   one because authenticated status performs SQL and locks a fixture row.
2. Add /preview-worker-auth-check with a native POST form to
   /api/preview-worker-auth-check in the SAME existing Preview deployment.
   The handler requires the exact Preview branch/hostname, disabled payment
   flags, recipient configuration, same Origin and Sec-Fetch-Site, and a bounded
   fixed confirmation form. The form cannot choose a target, action, order,
   recipient or credential. GET cannot perform the test.
3. The existing Preview runtime uses its already-bound credential only inside
   the server process, constructing an auth_check request for the original
   Bearer verifier. No credential is returned to the model, browser, URL,
   Actions, n8n, artifacts or logs. No external secret retrieval is added.
4. Whitelist the response and require the exact nonce, scope, branch, commit,
   hostname and no-side-effect flags. A generic HTTP 200 is not acceptance.
   Mark transport=protected-browser-post-with-in-process-bearer-verification and
   externalWorkerHttpVerified=false. This is deliberately an operator-mediated
   authentication preflight, NOT an external n8n/GitHub Worker HTTP acceptance.
5. Extend only the existing Actions test command with the new local security
   tests. No Actions permission, Secret, environment or remote execution job is
   added. No new Worker, Store, database or scheduler is created.

## Approval-sensitive impact

This adds a narrow authorization delegation: people already able to access the
protected Preview may invoke this no-data, no-mutation probe without possessing
the Worker bearer themselves. The original Worker endpoint still requires its
Bearer; no customer/business/fixture operations are exposed through the new
form. The current Preview Deployment Protection must remain ON. Production,
other branches, other hostnames and cross-origin requests are rejected.

Approval is requested before pushing this patch or deploying it. Approval covers
only PR #20 and timeease-v2-secure Preview, not Production, access-policy changes,
Actions Secrets, orders, SQL, Blob operations, payments or email.

## Validation and staged execution

Local validation: 11 new tests PASS and TypeScript noEmit PASS, using only
synthetic credentials. No previous runtime acceptance test was repeated.

After approval: recheck PR head, commit only this reviewed diff, require existing
remote CI success, deploy that exact PR commit with target omitted (Preview),
and verify its unique hostname/commit and unchanged protection. The user opens
the new page in their already-authorized browser and submits its fixed form.
No Cloud Browser login is required. Existing connectors cannot perform this
authenticated form POST, so the manual click is the remaining execution step.

Record actual HTTP status, request nonce, Vercel request ID, deployment ID and
commit. Require authenticated=true and scope=auth-check-only, with all of
databaseAccessed/blobAccessed/ordersTouched/emailSent false. Preserve the false
externalWorkerHttpVerified flag in the report. Do not treat local tests or this
preflight as full order E2E or automatic Worker delivery acceptance.

No synthetic-order SQL may run before a separately approved next phase. Shopify
#1033 and all Production configurations/workflows remain untouched.
