# Implementation Plan: Booking và xuất báo cáo

**Branch**: `004-booking-export` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-booking-export/spec.md`

## Summary

Mở rộng Adsup bằng Module 4 cho hồ sơ khách tenant-scoped, booking theo lịch và walk-in,
dynamic booking form, khoảng cách 60 phút theo nhân viên/cơ sở, ARRIVED + consent + photo debt,
công tour, lý do hủy/reschedule có lịch sử, báo cáo chat 20:08/22:00 và XLSX native. Module tái
sử dụng auth/RBAC/audit/idempotency, FormVersion/FormSubmission, MediaObject, ChatChannel,
ActionItem, outbox và KPI source contract từ Module 1-3. PostgreSQL là nguồn sự thật; worker tạo
báo cáo/export và xử lý retention bằng lease/checkpoint/retry. PDF và mobile UI không thuộc
Module 4.

## Technical Context

**Language/Version**: TypeScript 5.9 trên Node.js 24

**Primary Dependencies**: Express 5, Prisma 7, PostgreSQL, Zod 4, AJV 8, Pino 10, ExcelJS
streaming writer; dùng lại media, chat, audit, idempotency, outbox, action-item và worker
foundations hiện có

**Storage**: PostgreSQL là system of record; object storage S3-compatible giữ ảnh khách và XLSX
qua `MediaObject`; JSONB chỉ dùng cho schema-versioned form data, immutable snapshots và job
payload/checkpoint

**Testing**: Vitest 4, Supertest, Prisma Dev PostgreSQL; unit, contract, integration, migration,
tenant/branch isolation, RBAC, concurrency/idempotency, worker retry, retention và load smoke

**Target Platform**: API/worker Linux container stateless; local Windows dùng Docker Compose,
Prisma scripts và memory/test-double adapters hiện có

**Project Type**: TypeScript monorepo gồm API, worker và shared packages; React Native mobile là
consumer ở Module 5

**Performance Goals**: booking reads/writes p95 < 2 giây ở tải toàn hệ thống 200 request/giây;
20.000 booking/ngày; report scheduled hoàn tất trong 5 phút; XLSX streaming không giữ toàn bộ
dataset trong RAM

**Constraints**: tenant/branch scope trên schema, constraint, query, object key, job, event và
chat destination; khoảng cách start-time 60 phút phải chống race ở PostgreSQL; history/audit
append-only; không Google Sheets/Local Storage làm nguồn; không credential cloud thật cho local;
không PDF, mobile UI, self-booking, payment/payroll hoặc resource-capacity scheduling

**Scale/Scope**: 100 tenant, 500 cơ sở, 10.000 tài khoản, 20.000 booking/ngày, 200 API
request/giây; ảnh khách mặc định 180 ngày, XLSX 30 ngày, metadata/audit 5 năm

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

1. API derives tenant, actor membership and allowed branch scope from JWT/membership/RBAC. Client
   cannot authoritatively set tenant, actor, server time, consent actor, status history, report
   totals, export object key or KPI actuals.
2. Scheduled booking creation validates customer branch visibility, effective versioned service
   branch availability, employee effective assignment and published booking FormVersion. A
   PostgreSQL partial GiST
   exclusion constraint over `[scheduled_start_at, scheduled_start_at + 60 minutes)` for active
   scheduled bookings is the final race-safe guard; service validation returns a clearer conflict.
3. Walk-in creation uses server time, type `WALK_IN` and ARRIVED transition in one transaction.
   It bypasses only the 60-minute exclusion, not tenant/branch/RBAC/consent/photo rules.
4. Every booking transition appends `BookingStatusTransition`; cancellation reason label/code and
   effective policy/form version are snapshotted. Reschedule locks the source, validates/creates
   the replacement and appends both histories in one transaction.
5. Consent is stored before a booking-scoped customer-photo upload intent can be issued. ARRIVED
   without READY photo creates one `CustomerPhotoDebt` and Module 2 action item via deterministic
   source key. Media completion closes debt/action item idempotently through outbox consumer.
6. Tour completion locks booking/debt/media, validates ARRIVED + READY customer photo, appends
   completion and emits `booking.tour-completed.v1` for the KPI source adapter.
7. Scheduler evaluates tenant-local 20:08 and 22:00 windows. A leased `BookingJobRun` snapshots
   tenant/branch/date/report type, renders deterministic report content and emits one chat message
   per configured destination using a dedupe key. Rerun is explicit and audited.
8. Export API records a bounded filter/scope request. Worker reads stable, keyset-paginated
   snapshots, streams XLSX to temporary storage, uploads via object-storage adapter, verifies
   checksum and atomically marks export READY. Same request key cannot create duplicate jobs/files.
9. Retention policy is versioned. Worker deletes customer-photo/XLSX binaries only after expiry,
   respects legal hold and persists `MediaRetentionTombstone`; metadata/audit remains.
10. Domain events are written to transactional outbox with the state change. Consumers use
    tenant + event ID/dedupe key and may retry without duplicate action items, KPI facts, files or
    chat messages.

## Project Structure

### Documentation (this feature)

```text
specs/004-booking-export/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.yaml
│   ├── domain-events.md
│   └── booking-kpi-source-adapter.md
├── checklists/
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── api/
│   ├── src/modules/bookings/          # customer, booking, arrival, tour, config, export APIs
│   └── tests/{unit,contract,integration}/
└── worker/
    ├── src/bookings/                  # reports, action-item reconciliation, retention
    ├── src/exports/                   # XLSX stream generation and lifecycle
    └── tests/{unit,integration}/
packages/
├── contracts/src/booking.ts           # Zod schemas/events shared by API/mobile/worker
├── database/
│   ├── prisma/{schema.prisma,migrations/,seed.ts}
│   └── src/{booking.repository.ts,booking-worker.repository.ts,export.repository.ts}
├── domain/src/bookings/               # pure state/conflict/report/retention rules
└── testing/src/                       # deterministic clock/storage/chat collectors
tests/
├── migration/
└── load/
```

**Structure Decision**: Giữ layering và deployment units đã ổn định từ Module 1-3. Module 4 thêm
bounded module `bookings` và `exports`, không tạo microservice mới. Cách này giữ transaction,
tenant isolation, contract và worker lease cùng một mô hình đã được kiểm chứng.

## Phase 0: Research Outcomes

Các quyết định và phương án loại bỏ được ghi tại [research.md](./research.md). Không còn câu hỏi
blocking; PDF được loại khỏi implementation theo quyết định ngày 2026-07-24.

## Phase 1: Design Outcomes

- Entities, keys, constraints and state machines: [data-model.md](./data-model.md)
- HTTP API: [contracts/openapi.yaml](./contracts/openapi.yaml)
- Outbox/domain events: [contracts/domain-events.md](./contracts/domain-events.md)
- Module 2 KPI source boundary: [contracts/booking-kpi-source-adapter.md](./contracts/booking-kpi-source-adapter.md)
- Local validation: [quickstart.md](./quickstart.md)

## Verification Strategy

- Unit: 60-minute boundaries, active-status conflict set, walk-in behavior, state transitions,
  cancellation version resolution, consent/photo debt, tour completion, formula neutralization,
  report aggregation, retention/legal hold and retry backoff.
- Contract: OpenAPI/Zod drift, success/problem responses, RBAC metadata, idempotency replay/hash
  conflict, stable pagination and domain event schemas.
- Integration: tenant/branch denial, form/media/chat cross-scope IDs, concurrent booking/reschedule,
  arrival/media completion races, action-item closure, scheduled report dedupe, export retry and
  signed download re-authorization.
- Migration/seed: clean deploy and upgrade from Module 3, `btree_gist` extension/exclusion
  constraint, composite tenant FKs, deterministic seed and policy/form verification.
- Worker/load: 20:08/22:00 timezone windows, lease/heartbeat/checkpoint/recovery, 20.000
  bookings/day aggregation, XLSX memory bound, outbox delivery and retention tombstones.
- Gates: Prisma format/validate/generate/migration tests, format, lint, typecheck, unit, contract,
  integration, coverage, load smoke, API/worker build, secret/PII log scan and converge.

## Complexity Tracking

Không có vi phạm Constitution cần biện minh.
