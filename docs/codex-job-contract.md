# Codex Job Contract

Use this contract when Opportunity Watch / n8n routes an engineering task to the TimeEase Codex Worker.

## Required fields

```json
{
  "job_id": "TE-2026-0001",
  "title": "Fix Shopify paid-order webhook",
  "status": "READY_FOR_CODEX",
  "repository": "goplanetdigital/timeease-web",
  "task_type": "code",
  "requirements": [
    "Save newly paid orders",
    "Prevent duplicate order records"
  ],
  "acceptance_criteria": [
    "Duplicate webhook delivery does not create a second order",
    "Existing checkout flow still builds"
  ],
  "scope": {
    "allowed_paths": ["app", "lib"],
    "forbidden_actions": [
      "change production secrets",
      "change Stripe payout destination"
    ]
  },
  "inputs": {
    "issue_url": null,
    "file_urls": [],
    "notes": ""
  },
  "commercial": {
    "approved": true,
    "paid": true,
    "currency": "USD",
    "amount": 149
  },
  "deadline": null
}
```

## Worker response

```json
{
  "job_id": "TE-2026-0001",
  "result": "COMPLETED",
  "summary": "Implemented idempotent paid-order handling.",
  "files_changed": [],
  "acceptance_criteria": [
    {
      "criterion": "Duplicate webhook delivery does not create a second order",
      "status": "PASS"
    }
  ],
  "checks": [
    {
      "command": "npm run build",
      "status": "PASS"
    }
  ],
  "deploy_safe": true,
  "risks": [],
  "follow_up": []
}
```

## Valid result values
- `COMPLETED`
- `BLOCKED`
- `NEEDS_INFO`
- `HUMAN_REVIEW`

## Block instead of guessing
Use `BLOCKED` or `HUMAN_REVIEW` when credentials, customer authorization, payment configuration, destructive migrations, or unclear acceptance criteria prevent safe completion.
