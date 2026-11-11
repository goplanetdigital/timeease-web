# Codex Job Intake API

Endpoint:

`POST /api/jobs/intake`

Purpose:

Accept a qualified TimeEase engineering job from n8n or another orchestrator, validate the required contract, and return whether the job is ready to dispatch to Codex.

This endpoint does **not**:
- charge a customer
- send email
- deploy code
- invoke Codex by itself
- persist jobs to a database

It is intentionally a safe boundary between qualification/orchestration and the Codex engineering worker.

## Example request

```json
{
  "job_id": "TE-20261008-001",
  "repository": "customer/example-repo",
  "task": "Fix the Shopify paid-order webhook so paid orders are stored exactly once.",
  "acceptance_criteria": [
    "Paid orders are saved",
    "Duplicate webhook delivery does not create duplicate orders",
    "Existing checkout flow still builds"
  ],
  "allowed_scope": [
    "app/api/shopify/**",
    "lib/orders/**"
  ],
  "forbidden_scope": [
    "production billing changes",
    "secrets and credentials",
    "unrelated repositories"
  ],
  "delivery_type": "pull_request",
  "customer_deadline": null,
  "notes": ""
}
```

## Ready response

HTTP 202

```json
{
  "ok": true,
  "status": "READY_FOR_CODEX",
  "job": {},
  "next_action": "dispatch_to_codex_worker"
}
```

## Clarification response

HTTP 422

```json
{
  "ok": false,
  "status": "NEEDS_CLARIFICATION",
  "errors": [
    "acceptance_criteria must contain at least one item"
  ]
}
```

## n8n usage

The n8n Qualifier should POST the standard job payload to this endpoint.

- 202 => continue to the Codex dispatch step.
- 422 => send the job to clarification/manual review.
- 400 => malformed JSON; treat as workflow error.

The dispatch step should remain separate from intake so production credentials and execution permissions are isolated.
