# Implementation Plan: Chấm công và workflow duyệt

**Branch**: `003-timekeeping-workflows` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-timekeeping-workflows/spec.md`

## Summary

Mở rộng nền tảng Adsup bằng Module 3 cho lịch ca, video check-in, tính đi muộn, lịch nghỉ/nghỉ
đột xuất, workflow duyệt, sổ phạt attendance và nguồn `ATTENDANCE_ON_TIME_RATE` cho Module 2.
Module này giữ mọi dữ liệu tenant/branch-scoped, snapshot lịch và policy khi phát sinh nghiệp vụ,
xử lý video conversion qua worker retry-safe, tạo penalty settlement append-only và dùng workflow
versioned cho đổi ca, xin đi muộn, lịch nghỉ và nghỉ đột xuất. MVP không làm quỹ phép/số dư ngày
phép và không dùng AI tự chấm chất lượng video; video không đạt chỉ do người có quyền review thủ công.

## Technical Context

**Language/Version**: TypeScript 5.9 trên Node.js 24

**Primary Dependencies**: Express 5, Prisma 7, PostgreSQL, Zod 4, AJV 8, Pino 10; dùng lại media,
audit, idempotency, action-item, notification, realtime và worker/outbox foundations từ Module 1/2

**Storage**: PostgreSQL là system of record; object storage S3-compatible giữ video/chứng từ qua
`MediaObject`; JSONB chỉ dùng cho rule snapshot, policy cấu hình và payload đã schema-versioned

**Testing**: Vitest 4, Supertest, Prisma Dev PostgreSQL; unit, contract, integration, migration,
tenant-isolation, media lifecycle, worker retry/concurrency và load smoke

**Target Platform**: API/worker Linux container stateless; local Windows dùng script và adapter/test
double hiện có

**Project Type**: TypeScript monorepo gồm API, worker và shared packages; mobile là consumer ở Module 5

**Performance Goals**: attendance/action-item đọc p95 < 500 ms ở load profile chuẩn; check-in/upload
request không chờ conversion; notification/action item cập nhật trong vòng 5 giây ở test; worker xử lý
10.000 video check-in/ngày bằng batch có checkpoint

**Constraints**: tenant/branch isolation trên mọi bảng, khóa, query, worker và object key; lịch, policy,
workflow, penalty và quyết định phải versioned hoặc append-only; không dùng `ADMIN_IDS`, Telegram,
Google Sheets, Local Storage hay client cache làm nguồn sự thật; không cần AWS/FCM/APNs thật trong local
test; không triển khai booking queue, payroll, payment gateway, leave balance hay workflow builder tổng quát

**Scale/Scope**: 100 tenant, 500 cơ sở, 10.000 tài khoản, 10.000 video check-in/ngày, 200 API request/giây;
tenant mẫu có 30 membership, 3 cơ sở và hai ca 08:30/09:30

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1.*

- [x] Every tenant-owned data path is tenant-scoped in schema, authorization, constraints,
      indexes, cache/storage keys, workers, realtime rooms, and negative isolation tests.
- [x] Identity and permissions come from authenticated membership/RBAC/branch scope; the
      backend remains authoritative and no hard-coded administrator IDs are introduced.
- [x] Historical business state is versioned or append-only, audited, transaction-safe, and
      idempotent under retries and concurrent requests.
- [x] Shared schemas and contracts are explicit; dynamic JSONB is schema-versioned; S3,
      Redis, Socket.io, FCM, and APNs are behind testable adapters.
- [x] Unit, contract, integration, tenant-isolation, migration, typecheck, lint, and build
      gates are planned with traceability to requirements.
- [x] Observability, privacy/consent, retention, backup/restore, capacity targets, and
      credential-free local testing are addressed where the feature touches them.

## Architecture and Transaction Boundaries

1. API validates request contracts, derives tenant/actor/branch scope from authenticated membership,
   then calls Module 3 services. Client-supplied tenant, actor, server time, late minutes, penalty
   amount, approval result side effects and KPI actuals are ignored or rejected.
2. Schedule writes create immutable `WorkScheduleVersion` rows. Self-edit before 24 hours may create
   an approved schedule version directly; requests inside 24 hours and manager post-start adjustments
   create workflow/audit history.
3. Check-in records snapshot effective schedule, assignment branch, tenant timezone, timestamp server,
   video policy version and media ID. Video conversion runs only in worker; API never waits for conversion.
4. Attendance reminder workers run 15 minutes before each tenant-local shift start and again at the final
   pre-cutoff reminder time, default 11:00 for the 12:00 cutoff, then emit deduped bot notification payloads
   tagging scheduled members who have not checked in, excluding OFF/approved leave.
5. Attendance evaluation workers evaluate missing check-in at the 12:00 tenant-local cutoff: after-15:00
   check-in remains a worked day and report-eligible, and no check-in or approved correction after the cutoff
   is marked non-worked for KPI reporting while still producing applicable absence/check-in violations.
6. Penalty settlement stores individual violations and one explainable settlement projection. The
   `MAX_OF_VIDEO_AND_LATE` rule suppresses the smaller base component but preserves both source violations.
   Payment and adjustments are append-only.
7. Workflow definitions are versioned and limited to Module 3 request types. Approval runs lock the active
   step, enforce sequential/parallel completion rules, and apply final effects once in the same transaction
   as audit/outbox/action-item updates.
8. Company OFF calendars are versioned by tenant or branch. OFF days suppress check-in, attendance KPI,
   daily KPI report requirement and attendance penalties, and do not count toward the monthly absence threshold.
9. `ATTENDANCE_ON_TIME_RATE` implements the Module 2 source adapter using only confirmed attendance
   snapshots; it returns `null` for missing source and never exposes video/signed URL details.

## Project Structure

### Documentation (this feature)

```text
specs/003-timekeeping-workflows/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.yaml
│   ├── domain-events.md
│   └── attendance-source-adapter.md
├── checklists/
└── tasks.md             # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
apps/
├── api/
│   ├── src/modules/attendance/       # schedules, check-in, video review, attendance reads
│   ├── src/modules/workflows/        # request definitions, approval runs/decisions
│   ├── src/modules/penalties/        # attendance penalty settlement/payment
│   └── tests/{unit,contract,integration}/
└── worker/
    ├── src/attendance/               # day close, missing check-in, video conversion, absence summary
    └── tests/{unit,integration}/
packages/
├── contracts/src/                    # Zod/OpenAPI schemas for Module 3
├── database/
│   ├── prisma/{schema.prisma,migrations/,seed.ts}
│   └── src/{attendance.repository.ts,workflow.repository.ts,penalty.repository.ts}
├── domain/src/attendance/            # pure time/late/absence/settlement rules
├── domain/src/workflows/             # pure approval state machine
└── testing/src/                      # deterministic clocks, media/push/realtime collectors
tests/
├── migration/
└── load/
```

**Structure Decision**: Giữ monorepo và layering đã ổn định từ Module 1/2. Module 3 thêm bounded
modules trong API/worker và shared packages thay vì tạo service riêng. Điều này giữ transaction,
contracts, audit/idempotency và tenant isolation cùng một kiểu triển khai đã được kiểm chứng.

## Phase 0: Research Outcomes

Các quyết định và phương án bị loại được ghi trong [research.md](./research.md). Các điểm mơ hồ blocking đã
được clarify; các xung đột giữa skill gốc và spec đã clarify được giải quyết theo spec/PRD.

## Phase 1: Design Outcomes

- Data model, state machines, keys and retention: [data-model.md](./data-model.md)
- HTTP contract: [contracts/openapi.yaml](./contracts/openapi.yaml)
- Domain/outbox events: [contracts/domain-events.md](./contracts/domain-events.md)
- Module 2 source adapter: [contracts/attendance-source-adapter.md](./contracts/attendance-source-adapter.md)
- Local validation guide: [quickstart.md](./quickstart.md)

## Verification Strategy

- Unit: late minute rounding, 12:00 missing-check-in cutoff, 15:00 worked-late classification, first-late exemption, 16-89 excess-minute
  penalty, settlement max rule, absence day counting, OFF-calendar resolution and approval state machine.
- Contract: all Module 3 endpoints cover success, validation, authn/authz, idempotency replay/conflict,
  safe errors and scoped pagination.
- Integration: cross-tenant denial, branch-scoped manager access, schedule version snapshot, video
  policy acknowledgement, media lifecycle failure/retry, workflow races, OFF day suppression, absence
  summary notification and attendance KPI source.
- Migration/seed: clean deploy and upgrade from Module 2 schema, composite tenant FKs, partial unique
  keys for active versions/runs and deterministic seed rerun counts.
- Worker/load: 15-minute check-in reminder fan-out, 11:00 final no-check-in warning, video conversion retries, 12:00 missing-check-in close, monthly absence summary,
  outbox delivery, 100 concurrent approvals and 10.000 check-in/day smoke profile.
- Gates: format, lint, typecheck, Prisma validate/generate/status, unit/contract/integration/migration,
  coverage, build, secret/log redaction scan and `speckit-converge`.

## Complexity Tracking

Không có vi phạm Constitution cần biện minh.
