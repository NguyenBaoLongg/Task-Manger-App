---
name: build-timekeeping-workflows
description: "Specify, implement, and test tenant-configurable video attendance, media conversion, late-arrival penalties, leave balances, request routing, and dynamic one-level, multi-level, or parallel approval workflows. Use for check-in video APIs, attendance calculations, leave or late requests, approval state machines, approver notifications, or schedule updates."
---

# Build Timekeeping and Workflows

Read [the timekeeping and workflow requirements](references/Skill_03_Timekeeping_and_Workflows.md) before planning or implementation. Require tenant, user, RBAC, media-storage, and notification foundations first.

## Workflow

1. Inspect the current Spec Kit feature and shared architecture.
2. Model work schedules, attendance events, video assets, tenant penalty policies, penalty instances, leave balances, request types, workflow definitions, workflow steps, approver assignments, approval runs, and decisions.
3. Upload media through the storage adapter. Process WebM-to-MP4 conversion in a retryable background job and record media lifecycle states.
4. Calculate late duration in a defined tenant timezone and against the applicable schedule version.
5. Apply the policy exactly: first late occurrence is exempt; later occurrences use tenant-configured X, Y, Z, and maximum amounts; an approved late request reduces the penalty by 50 percent.
6. Version penalty policies so historical results remain reproducible.
7. Model one-level, sequential multi-level, and parallel approvals as explicit state machines. Define completion rules for parallel approvals.
8. Send push notifications to resolved approvers and make notification retries idempotent.
9. Update leave balance or change the schedule to `OFF` inside the same transaction that finalizes approval.
10. Test timezone boundaries, repeated events, policy versions, approval races, parallel decisions, insufficient leave, media failures, and cross-tenant access.

## Boundaries

- Do not convert video synchronously in an API request.
- Do not derive tenant configuration from untrusted client data.
- Do not mutate historical penalties when a tenant changes policy.
- Do not decrement leave twice when callbacks or approvals retry.
- Clarify legal, payroll, retention, consent, and biometric implications before production rollout.

## Completion

Report schemas, APIs, jobs, state transitions, transaction boundaries, policy examples, tests, and unresolved compliance decisions.
