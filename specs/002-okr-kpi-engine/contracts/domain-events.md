# Domain and Outbox Events

All events use envelope fields `eventId`, `tenantId`, `eventType`, `schemaVersion`, `aggregateType`,
`aggregateId`, `occurredAt`, `correlationId`, `dedupeKey`, and redacted `data`. Consumers MUST deduplicate by
`eventId` or documented effect key and MUST re-authorize any subsequent read.

| Event | Schema | Producer | Main consumers/effect key |
|---|---:|---|---|
| `kpi.policy.version-created` | 1 | API | audit/realtime: `policy:{id}` |
| `kpi.target.version-created` | 1 | API | recalc scheduler: `target:{id}` |
| `kpi.report.revision-created` | 1 | API | progress/realtime: `revision:{id}` |
| `kpi.progress.changed` | 1 | calculation | action item/push: `report:{reportId}:kpi:{kpiId}:{digest}` |
| `kpi.evaluation.closed` | 1 | close-day worker | penalty/action item: `evaluation:{id}` |
| `kpi.penalty.assessed` | 1 | close-day worker | notification: `penalty:{id}` |
| `kpi.penalty.adjusted` | 1 | API | notification/realtime: `adjustment:{id}` |
| `kpi.evidence.waiting` | 1 | API/worker | reminder/action item: `debt:{id}:waiting` |
| `kpi.evidence.satisfied` | 1 | media event handler | close action item: `debt:{id}:satisfied` |
| `kpi.evidence.overdue` | 1 | photo worker | penalty/notification: `debt:{id}:overdue` |
| `action-item.changed` | 1 | projection writer | Socket.io/push: `item:{id}:v{stateVersion}` |

Payloads contain IDs, business date, state/version and safe display aggregates only. Raw form JSON, revenue
details, signed URLs, email and user names MUST NOT be put in outbox payloads or logs.

Dispatcher contract:

1. Claim pending rows using bounded batch and lease.
2. Deliver through Module 1 realtime/notification ports.
3. Mark `SENT` only after adapter acknowledgement; on retry preserve event/effect key.
4. After configured attempts mark `DEAD_LETTER`, emit metric and retain safe error metadata.
5. A dead-letter retry reuses the same event ID and never creates another business record.
