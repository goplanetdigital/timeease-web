# TimeEase Revenue Engine

## Goal
Create a reliable path from finding a payable task to delivering a finished result without making one worker responsible for everything.

## Role split

### 1. Opportunity Watch
Find candidate work and capture source, budget, deadline, requirements, files, and communication constraints.

### 2. Qualifier
Reject work that is ambiguous, requires calls/interviews, cannot be executed safely, or is outside current capability.

Output one of:
- `READY_TO_QUOTE`
- `NEEDS_INFO`
- `REJECTED`

### 3. Sales / Payment
Prepare the proposal and price, keep communication text-only, and confirm payment or approved commercial terms before production work starts.

### 4. Codex Worker
Own repository-based engineering work:
- inspect the repository,
- implement the requested change,
- run checks,
- prepare a delivery summary.

Codex does not search for customers and does not make autonomous payment/refund decisions.

### 5. QA
Check acceptance criteria, build/test results, regression risk, and deliverable completeness.

Output one of:
- `PASS`
- `REWORK`
- `HUMAN_REVIEW`

### 6. Delivery
Send or expose the approved deliverable, README/handoff notes, and result links.

### 7. Revenue Tracker
Record quoted amount, paid amount, delivery status, cost, margin, and failure reason.

## Recommended lifecycle

`FOUND -> QUALIFYING -> READY_TO_QUOTE -> QUOTED -> PAID -> READY_FOR_CODEX -> IN_PROGRESS -> QA -> READY_TO_DELIVER -> DELIVERED -> CLOSED`

Exception states:

`NEEDS_INFO`, `REJECTED`, `BLOCKED`, `REWORK`, `REFUND_REVIEW`

## Routing principle
Only send a task to Codex after the commercial and requirement gates are satisfied.

Minimum gate:
- clear task title,
- repository or working files,
- acceptance criteria,
- deadline,
- scope boundary,
- payment/approval state,
- no unresolved critical question.

## Repository separation
Keep TimeEase work in this repository. Do not mix Go Planet / Primary One Readiness work into this Codex environment.
