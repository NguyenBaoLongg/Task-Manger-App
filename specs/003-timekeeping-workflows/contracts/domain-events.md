# Domain and Outbox Events

All Module 3 events use the existing envelope fields: `eventId`, `tenantId`, `eventType`,
`schemaVersion`, `aggregateType`, `aggregateId`, `occurredAt`, `correlationId`, `dedupeKey`, and redacted
`data`. Consumers deduplicate by `eventId` or documented effect key and re-authorize subsequent reads.

| Event | Schema | Producer | Main consumers/effect key |
|---|---:|---|---|
| `attendance.schedule.version-created` | 1 | API/workflow | realtime/action item: `schedule:{id}:v{version}` |
| `attendance.off-calendar.version-created` | 1 | API | close-day/report suppression: `off:{id}:v{version}` |
| `attendance.video-policy.acknowledged` | 1 | API | audit: `video-policy:{policyId}:member:{memberId}` |
| `attendance.checkin.recorded` | 1 | API | KPI source/action item: `attendance:{id}:checkin` |
| `attendance.checkin-reminder.due` | 1 | reminder worker | bot notification fan-out: pre-shift `attendance-checkin-reminder:{tenantId}:{branchId}:{businessDate}:{shiftId}:{leadMinutes}` or final `attendance-checkin-reminder-final:{tenantId}:{branchId}:{businessDate}:{shiftId}:{cutoffLocalTime}:{leadMinutes}` |
| `attendance.video.conversion-requested` | 1 | API | media worker: `video:{assetId}:convert` |
| `attendance.video.ready` | 1 | media worker | review/action item: `video:{assetId}:ready` |
| `attendance.video.failed` | 1 | media worker | action item/ops: `video:{assetId}:failed:{attempt}` |
| `attendance.video.reviewed` | 1 | API | penalty settlement: `review:{id}` |
| `attendance.day.closed` | 1 | worker | KPI source/action item: `attendance:{id}:closed` |
| `attendance.violation.assessed` | 1 | API/worker | settlement/notification: `violation:{id}` |
| `attendance.penalty.settled` | 1 | settlement service | notification/action item: `settlement:{id}` |
| `attendance.penalty.payment-transitioned` | 1 | API | realtime/audit: `payment:{transitionId}` |
| `workflow.request.submitted` | 1 | API | approver notification: `request:{id}:submitted` |
| `workflow.step.activated` | 1 | workflow service | approver action item: `step:{id}:activated` |
| `workflow.decision.recorded` | 1 | API | workflow engine: `decision:{id}` |
| `workflow.request.resolved` | 1 | workflow service | requester notification/effects: `request:{id}:{status}` |
| `absence.summary.threshold-exceeded` | 1 | monthly worker | manager notification: `absence:{memberId}:{yearMonth}:threshold` |
| `action-item.changed` | 1 | projection writer | Socket.io/push: `item:{id}:v{stateVersion}` |

Payload rules:

- Include IDs, business date/month, state, safe amount summaries and reason codes only.
- Do not include video URLs, signed URLs, raw chat body, raw evidence payload, access/refresh tokens,
  device tokens, email or Google profile data.
- Amounts use integer minor units and currency.
- Reminder events may include `reminderKind`, cutoff local time, mention membership IDs/display names and
  system-generated reminder text; they must not include raw user-authored chat body, device tokens, video URLs
  or signed media URLs.
- Event schema changes require version bump and contract tests.

Dispatcher contract:

1. Claim pending rows using bounded batch and lease.
2. Deliver through existing realtime/notification ports or internal worker consumers.
3. Mark `SENT` only after adapter acknowledgement.
4. Preserve event/effect key on retry; after configured attempts mark `DEAD_LETTER`.
5. Dead-letter retry reuses the same event ID and never creates a second business record.
