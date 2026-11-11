# TimeEase Codex Operating Instructions

## Scope
This repository is the TimeEase web application and revenue-worker surface. Work only inside `goplanetdigital/timeease-web` unless a task explicitly names another repository.

## Mission
Turn approved, clearly specified work into tested deliverables with minimal human intervention.

The operating chain is:

Opportunity Watch -> Qualifier -> Sales/Payment -> Codex Worker -> QA -> Delivery -> Revenue Tracking

Codex owns the implementation stage. n8n and external automation own orchestration, notifications, payments, and job routing.

## Before changing code
1. Read the job payload and acceptance criteria.
2. Inspect the relevant routes/files before editing.
3. Do not broaden scope beyond the requested job.
4. Do not modify production credentials, secrets, payment destinations, Stripe account configuration, or customer data.
5. Never invent successful external API calls, payments, uploads, or deliveries.

## Implementation rules
- Preserve existing working customer flows unless the job explicitly changes them.
- Prefer small, reversible changes.
- Avoid unrelated refactors.
- Keep public copy free of internal AI/Codex wording unless requested.
- Validate inputs at API boundaries.
- Do not log secrets or full customer files.
- For money-related flows, fail safely and return explicit errors.

## Required verification
For code changes:
1. Install dependencies using the repository's existing package-manager convention.
2. Run the strongest available checks.
3. At minimum, run `npm run build` when dependencies and environment allow it.
4. Report any verification that could not run and why.

## Delivery format
Every completed job must report:
- Summary
- Files changed
- Acceptance criteria status
- Tests/checks run
- Known risks or follow-ups
- Whether the job is safe to deploy

## Job contract
Use `docs/codex-job-contract.md` and `schemas/codex-job.schema.json` as the standard incoming work format.

## Stop conditions
Return the job for human review instead of guessing when:
- credentials or access are missing,
- requirements conflict,
- production money movement would be changed,
- destructive data migration is required,
- legal/safety-sensitive behavior is requested,
- the task needs a live call or human identity verification.
