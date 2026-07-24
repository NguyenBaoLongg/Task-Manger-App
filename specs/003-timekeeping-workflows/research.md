# Research: Chấm công và workflow duyệt

## Decision: Keep Module 3 scope to attendance/workflow, not leave balance

**Rationale**: Clarification confirmed MVP does not manage leave balances or accrued leave. The company
rules cover schedule leave, sudden leave, duplicate leave, consecutive leave, exceptions and penalties.
Planning a leave-balance ledger would create payroll-like scope not supported by the product source of truth.

**Alternatives considered**:

- Full leave balance with accrual/carryover: rejected as unrequested and likely to affect payroll policy.
- Simple monthly leave quota: rejected because the clarified rule is a >5 day notification/flag, not a
  balance that blocks or deducts.

## Decision: Use versioned schedule, policy and workflow snapshots

**Rationale**: Attendance calculations, penalties and approvals must remain reproducible after schedule,
OFF calendar, penalty policy or workflow definition changes. Snapshotting the effective schedule/policy/
workflow version at event creation or finalization matches the constitution and Module 2 pattern.

**Alternatives considered**:

- Reading current policy when displaying historical records: rejected because it rewrites history.
- Mutable schedule rows: rejected because check-in and late minutes would change when schedules are edited.

## Decision: Missing check-in closes at the 12:00 tenant-local cutoff

**Rationale**: The updated company rule requires employees with a scheduled working day to complete video check-in
before 12:00 tenant-local time. At 12:00, a scheduled day with no check-in and no approved OFF/leave creates the
missing-check-in violation. Later check-in or manager-approved correction can prove the employee worked and support
late-minute calculation, but it does not automatically remove the pre-noon missing-check-in violation.

**Alternatives considered**:

- Immediately at shift start: rejected because it would create false positives.
- End-of-day or 18:00 close: rejected because the user clarified the company wants the penalty at the 12:00 cutoff.
- Only manual manager close: rejected because the company rule requires enforceable missing check-in behavior.

## Decision: Separate worked-late, non-worked and OFF-day classification

**Rationale**: Check-in after 15:00 still means the person worked and must submit KPI report; no check-in by the
12:00 cutoff creates the missing-check-in violation, and if there is still no check-in or approved correction after
that cutoff the day is not worked for KPI-report requirement while absence/check-in penalties still apply.
Company OFF calendar suppresses check-in/report/attendance penalties and is not personal leave.

**Alternatives considered**:

- Treat every missing check-in as report failure: rejected by clarification.
- Treat every no-check-in as an OFF day: rejected because OFF must be manager-set.

## Decision: 15-minute pre-shift check-in reminder as an outbox effect

**Rationale**: The user clarified that before each shift, the bot should notify and tag employees who have not
checked in. The reminder is produced 15 minutes before the shift start in tenant-local time, scoped by tenant,
branch, business date and shift. The payload carries membership IDs and display names for mention rendering, while
the dedupe key prevents duplicate bot messages during worker retry.

**Alternatives considered**:

- Client-only reminder: rejected because mobile cache cannot be the source of who has checked in.
- One push per employee without a group payload: rejected because the requested behavior is a bot message that tags
  all unchecked-in names for the shift.
- Direct chat write from worker using a human author: rejected because the current chat schema has no system bot
  author; outbox payload keeps the system boundary explicit for the notification/chat adapter.

## Decision: Final no-check-in warning one hour before the 12:00 cutoff

**Rationale**: The company wants a final warning before the missing-check-in cutoff. At 11:00 tenant-local time,
the worker re-reads authoritative schedules and attendance events, then emits an idempotent tenant/branch/shift
outbox reminder that tags employees still missing video check-in. The 12:00 cutoff remains the enforcement point:
if there is still no check-in and no approved OFF/leave/correction path, the day defaults to non-worked and the
missing-check-in penalty is created by the attendance policy.

**Alternatives considered**:

- Client-only local alarm: rejected because the mobile client cannot safely know who has already checked in or
  whether an OFF/leave decision has been approved.
- Wait until exactly 12:00 to notify: rejected because the business rule asks for a final chance before the penalty.
- Send one company-wide unscoped message: rejected because branch/tenant scope and mention privacy must be preserved.

## Decision: Manual-only video quality review in MVP

**Rationale**: The rules include uniform/makeup/hair/shoes/work-area requirements, but the user confirmed the
tool cannot reliably auto-assess video quality today. MVP stores video, supports manual reviewer decisions,
and does not make AI/fraud claims.

**Alternatives considered**:

- AI-based video quality scoring: rejected for accuracy/compliance risk and scope.
- No video quality violation at all: rejected because the company policy still needs manual enforcement.

## Decision: Late penalty uses excess minutes over 15 for the 16-89 minute tier

**Rationale**: Clarification selected `2.000 VND * (late_minutes - 15)` for the 16-89 tier. This must be
implemented as exact integer money arithmetic and tested at 15, 16, 89 and 90 minute boundaries.

**Alternatives considered**:

- `2.000 VND * total late minutes`: rejected by clarification.
- Start the second tier at exactly 15 minutes: rejected because the selected rule keeps 1-15 as fixed amount.

## Decision: Approval workflow is generic only within Module 3 request types

**Rationale**: The PRD excludes a general workflow builder from MVP. A reusable state machine for
schedule-change, late-notice, leave and sudden-leave requests is valuable without exposing arbitrary
business workflow building.

**Alternatives considered**:

- Hard-code one manager approval for every request: rejected because requirements include one-level,
  sequential multi-level and parallel approvals.
- General low-code workflow builder: rejected as explicitly outside MVP.

## Decision: Store violation details separately from settlement/payment

**Rationale**: The company rule needs explainability: video failure and late can both occur, but settlement
charges the higher base component and adds independent no-notice penalties. Separate immutable violations
plus settlement projection preserves audit and supports later adjustment/payment flows.

**Alternatives considered**:

- One flat penalty row per employee/day: rejected because it hides suppressed components and reasons.
- Recalculate settlement on read only: rejected because policy changes must not rewrite historical amounts.

## Decision: Company OFF calendar is scoped by tenant or branch

**Rationale**: The user confirmed the company has no regular weekly off days, but managers can set holidays
or branch-specific OFF days to avoid false penalties. Tenant-wide and branch-scoped OFF entries cover
company-wide holidays and operational differences between clinics.

**Alternatives considered**:

- Global tenant-only OFF calendar: rejected because the user asked about multiple branches in one company.
- Employee-level OFF entries only: rejected because company/branch holidays should not count as personal leave.

## Decision: Monthly absence over-threshold is notification/flag, not leave-balance enforcement

**Rationale**: Clarification selected counting approved leave/sudden leave in the month, morning as 0.5 day,
excluding OFF calendar, and notifying managers when total exceeds 5 days. This is operational monitoring,
not payroll or leave-balance deduction.

**Alternatives considered**:

- Block the sixth day automatically: rejected because requirement says remind manager and mark over-limit.
- Count OFF calendar: rejected because manager-set holidays are not employee leave.

## Decision: Reuse Module 2 action item and KPI source boundaries

**Rationale**: Module 2 already owns KPI calculation and action-item projection. Module 3 should feed
attendance source snapshots and action-item sources through existing boundaries instead of duplicating KPI
or mobile feed logic.

**Alternatives considered**:

- New task/reminder subsystem: rejected to avoid duplicate action-item semantics.
- Let mobile infer attendance/KPI state: rejected by constitution and Module 2 contract.
