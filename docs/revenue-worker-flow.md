# TimeEase Revenue Worker Flow

## Production flow
Opportunity Watch -> Qualifier -> Sales/Payment -> Codex Worker -> QA -> Delivery -> Revenue Tracker

## Routing rules
Send a job to Codex only when it primarily requires software engineering, such as:
- bug fixes
- web/API development
- GitHub repository changes
- webhook/integration work
- automation code
- database/API wiring
- tests and refactors

Keep these outside Codex:
- lead sourcing
- pricing negotiation
- customer billing
- sending customer email
- production financial actions
- broad jobs without a clear repository or deliverable

## Standard job payload

```json
{
  "job_id": "TE-YYYYMMDD-001",
  "repository": "owner/repo",
  "task": "Plain-language implementation request",
  "acceptance_criteria": [
    "Observable outcome 1",
    "Observable outcome 2"
  ],
  "allowed_scope": [
    "Paths or systems Codex may change"
  ],
  "forbidden_scope": [
    "Production billing",
    "Unrelated repositories",
    "Secrets"
  ],
  "delivery_type": "pull_request",
  "customer_deadline": null,
  "notes": ""
}
```

## Qualifier gate
Before dispatch, the qualifier should answer:
1. Can this be completed without a call or live meeting?
2. Is the expected deliverable concrete?
3. Is the repository/input accessible?
4. Are acceptance criteria testable?
5. Can the work be performed without inventing customer requirements?
6. Does the expected value justify execution cost?

If any critical answer is no, route to clarification instead of Codex.

## QA gate
The QA stage should verify:
- requested behavior exists
- unrelated behavior was not changed intentionally
- build/type checks/tests were run where available
- no secrets were committed
- known limitations are written down
- delivery artifacts are complete

Only QA-approved work proceeds to Delivery.
