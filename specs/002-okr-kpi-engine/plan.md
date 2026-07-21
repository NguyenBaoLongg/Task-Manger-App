# Implementation Plan: KPI hằng ngày và việc cần hoàn thành

**Branch**: `002-okr-kpi-engine` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-okr-kpi-engine/spec.md`

## Summary

Mở rộng nền tảng đa tenant của Module 1 bằng engine KPI hằng ngày phía backend. Engine quản lý KPI,
target, source mapping và policy có phiên bản; nhận report revision từ form động; tính progress theo
nguồn có thẩm quyền; đóng ngày sau 20:00; tạo tối đa một khoản phạt KPI 100.000 VND/người/ngày theo
policy; quản lý nợ ảnh và action-item feed. PostgreSQL giữ toàn bộ lịch sử, worker xử lý theo batch có
checkpoint, outbox phát hiệu ứng sau commit, còn API Express chỉ cung cấp thao tác đã tenant/RBAC scope.
MVP giới hạn mỗi nhân viên ở đúng một cơ sở hiện hành; dữ liệu nhiều cơ sở làm evaluation dừng an toàn.

## Technical Context

**Language/Version**: TypeScript 5.9 trên Node.js 24

**Primary Dependencies**: Express 5, Prisma 7, PostgreSQL, Zod 4, AJV 8, Pino 10; adapter realtime và
notification đã có từ Module 1

**Storage**: PostgreSQL là system of record; JSONB chỉ dùng cho rule/mapping/snapshot có schema; ảnh ở
object storage S3-compatible thông qua `MediaObject`

**Testing**: Vitest 4, Supertest, Prisma Dev PostgreSQL; unit, contract, integration, migration,
tenant-isolation, retry/concurrency và load smoke

**Target Platform**: API/worker Linux container stateless; local Windows được hỗ trợ bằng script hiện có

**Project Type**: TypeScript monorepo gồm API, worker và shared packages; mobile là consumer ở Module 5

**Performance Goals**: progress/action-item p95 < 500 ms ở profile chuẩn; cập nhật badge/realtime trong
5 giây ở test; batch đánh giá 10.000 membership/ngày có thể resume

**Constraints**: tenant isolation trên mọi khóa/truy vấn/job; tiền lưu integer minor unit; giờ nghiệp vụ
theo IANA timezone và lưu UTC instant; mutation/job idempotent; kết quả đóng là bất biến; không cần cloud
credentials trong test; không triển khai OKR tree, weekly check-in hay perceptual-hash fraud detection

**Scale/Scope**: 10.000 tài khoản, 100 tenant, 500 cơ sở; ba KPI seed; một report/người/ngày với nhiều
revision; policy tenant hoặc branch override; một cơ sở hiện hành cho mỗi nhân viên trong MVP

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1.*

- [x] Tenant ownership is structural: every new table begins with `tenant_id`; all composite keys,
      repositories, jobs, outbox partitions, queries and negative tests retain tenant scope.
- [x] Identity and authorization are inherited from authenticated membership/RBAC/branch scope. New
      permissions are seeded; no request body can elevate tenant or branch access.
- [x] Policy, target, mapping, revisions, calculations, evaluations and financial outcomes are
      versioned or append-only. Mutations require reason, audit and idempotency; jobs have uniqueness
      keys and checkpoints.
- [x] Shared Zod/OpenAPI contracts precede implementation. Form JSONB remains tied to published
      `FormVersion`; attendance is an adapter/test double until Module 3; realtime/push use Module 1 ports.
- [x] FR/CR coverage is planned across unit, contract, integration, isolation, migration,
      retry/concurrency and load tests; typecheck, lint and build remain module gates.
- [x] Logs/metrics exclude raw KPI/form/member values and high-cardinality tenant labels. Existing media
      authorization/retention is reused; history follows five-year KPI metadata retention; worker scales
      by bounded batches without production credentials locally.

## Architecture and Transaction Boundaries

1. API validates Zod input, resolves active membership and branch scope, then calls a tenant-scoped
   application service. Client-supplied `tenantId`, automatic actuals, exemption flags and server time are
   ignored or rejected.
2. KPI configuration writes an immutable version or effective-dated row in a Prisma transaction with
   audit and an outbox event. Bulk branch policy application is all-or-nothing.
3. A daily report is a stable header plus immutable revisions referencing a Module 1 `FormSubmission`.
   Recalculation writes append-only calculation events and updates only the open-day projection/action item.
4. The worker claims a unique `(tenant, business_date, job_type)` run, resolves the policy snapshot and
   the employee's sole effective branch, evaluates in bounded pages, and commits one employee at a time.
   Unique business keys prevent duplicate evaluation, penalty, reminder and outbox effects.
5. Closing produces an immutable evaluation and penalty outcome. Corrections are separate adjustments;
   they never rewrite original amount or failed-KPI detail.
6. Outbox dispatch happens only after commit. Realtime, push and future consumers deduplicate by event ID.

## Project Structure

### Documentation (this feature)

```text
specs/002-okr-kpi-engine/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.yaml
│   ├── domain-events.md
│   └── source-adapter.md
├── checklists/
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── api/
│   ├── src/modules/kpi/              # config, reports, progress, evaluation, penalties
│   ├── src/modules/action-items/     # employee and manager read models
│   └── tests/{unit,contract,integration}/
└── worker/
    ├── src/kpi/                      # close-day, photo-debt, outbox jobs
    └── tests/{unit,integration}/
packages/
├── contracts/src/                    # shared Zod/OpenAPI validation
├── database/
│   ├── prisma/{schema.prisma,migrations/,seed.ts}
│   └── src/{kpi.repository.ts,kpi-worker.repository.ts}
├── domain/src/kpi/                   # pure money/time/progress/policy rules and ports
└── testing/src/                      # clocks, source/media/realtime test doubles
tests/
├── migration/
└── load/
```

**Structure Decision**: Giữ monorepo và layering đã ổn định từ Module 1. Không tạo service riêng cho KPI;
API và worker chia sẻ domain/contracts/database package để giảm contract drift, trong khi worker vẫn có
entry point và transaction boundary độc lập để scale ngang.

## Phase 0: Research Outcomes

Các quyết định và phương án bị loại được ghi trong [research.md](./research.md). Không còn điểm làm rõ
chặn implementation; mọi lựa chọn kỹ thuật đều dùng dependency hiện có hoặc adapter nội bộ.

## Phase 1: Design Outcomes

- Mô hình quan hệ, trạng thái, khóa duy nhất và index: [data-model.md](./data-model.md)
- HTTP contract: [contracts/openapi.yaml](./contracts/openapi.yaml)
- Domain/outbox events: [contracts/domain-events.md](./contracts/domain-events.md)
- Source adapter boundary: [contracts/source-adapter.md](./contracts/source-adapter.md)
- Chạy và kiểm chứng local: [quickstart.md](./quickstart.md)

## Verification Strategy

- Unit: target precedence, money/count/percentage arithmetic, exact report boundary, policy selection,
  all-required pass rule, evidence count/state machine and idempotency fingerprints.
- Contract: every published endpoint success plus validation/authentication/authorization,
  idempotency replay/conflict and safe error shape.
- Integration: immutable revisions, single-branch fail-safe, source ownership, cross-tenant denial,
  atomic multi-branch policy, audit/outbox commit, 100 concurrent/retry evaluation uniqueness,
  adjustment ledger and realtime action-item update.
- Migration: clean deploy and upgrade from Module 1 schema; composite tenant references and unique keys
  verified against live PostgreSQL; seed reruns produce exact counts.
- Worker/load: checkpoint resume, lease expiry, poison-item isolation, 10.000 membership fixture and
  progress/action-item p95 measurement without hard-coded business caps.
- Gates: format check, lint, typecheck, Prisma validate/generate/status, all tests with coverage, build,
  secret scan and Spec Kit convergence.

## Complexity Tracking

Không có vi phạm Constitution cần biện minh.
