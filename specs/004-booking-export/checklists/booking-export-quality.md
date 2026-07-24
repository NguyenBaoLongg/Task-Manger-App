# Requirements Quality Checklist: Booking và XLSX Export

**Purpose**: Kiểm tra chất lượng, độ đầy đủ và tính nhất quán của requirements trước khi tạo tasks
**Created**: 2026-07-24
**Feature**: [spec.md](../spec.md)

## Scope and Source of Truth

- [x] CHK001 Spec có xác định rõ chỉ nhân viên nội bộ quản lý booking và khách không tự đặt lịch
  trong MVP không? [Completeness, Spec §FR-001]
- [x] CHK002 Ranh giới Module 4 có loại trừ mobile UI, PDF, payment/payroll, room/equipment conflict
  và customer login một cách nhất quán không? [Consistency, Spec §FR-046..FR-047]
- [x] CHK003 Dynamic form, media, chat, action item, KPI và penalty có được mô tả là tái sử dụng
  contract Module 1-3 thay vì tạo nguồn dữ liệu song song không? [Dependency, Spec §FR-042]

## Tenant Isolation, RBAC and PII

- [x] CHK004 Mọi customer/booking/media/report/export entity có ownership tenant rõ ràng không?
  [Completeness, Spec §CR-001]
- [x] CHK005 Branch visibility của customer và booking có quy tắc đủ rõ cho khách từng xuất hiện
  ở nhiều cơ sở không? [Clarity, Research §3]
- [x] CHK006 Permission/scope cho customer, booking, arrival, outcome, tour, configuration, report,
  export, retention, legal hold và correction có được nêu đầy đủ không? [Coverage, Spec §CR-002]
- [x] CHK007 Cross-tenant và out-of-branch denial có yêu cầu không tiết lộ sự tồn tại/PII không?
  [Security, Spec §CR-001]
- [x] CHK008 Quyền download XLSX có được kiểm tra lại tại thời điểm tải, không chỉ lúc tạo không?
  [Security, Spec §FR-035]
- [x] CHK009 Yêu cầu redaction có bao phủ log, audit snapshot, event, signed URL, object key và
  customer PII không? [Privacy, Spec §CR-004]

## Booking and Dynamic Forms

- [x] CHK010 Điều kiện cùng tenant/cơ sở của customer, service, assigned membership, form version
  và media có testable và không mâu thuẫn không? [Consistency, Spec §FR-003..FR-007]
- [x] CHK011 Requirements có xác định published FormVersion bất biến và submission lịch sử không
  bị diễn giải lại không? [Auditability, Spec §FR-006..FR-007]
- [x] CHK012 Ranh giới 59/60 phút, cùng nhân viên/cơ sở, nhân viên khác và terminal booking có đủ
  acceptance scenarios không? [Boundary, User Story 1]
- [x] CHK013 Race giữa hai create/reschedule có yêu cầu outcome nguyên tử, tối đa một commit không?
  [Concurrency, Spec §FR-010]
- [x] CHK014 WALK_IN có được giới hạn chỉ bỏ qua rule 60 phút, vẫn giữ RBAC/consent/photo/tour
  requirements và không được đặt tương lai không? [Exception, Spec §FR-011]
- [x] CHK015 Correction booking type/status có yêu cầu permission, reason, version conflict và
  audit trước/sau không? [Auditability, Spec §FR-012..FR-014]

## Status, Cancellation and Reschedule

- [x] CHK016 State machine có phân biệt booking arrival với tour completion và terminal outcomes
  không? [Clarity, Data Model §BookingStatusTransition]
- [x] CHK017 Cancellation/reschedule reason có version/effective interval và snapshot code/label
  trên transition không? [Historical accuracy, Spec §FR-020..FR-022]
- [x] CHK018 Reschedule có yêu cầu giữ source, tạo replacement, liên kết hai chiều và kiểm tra lại
  conflict/scope atomically không? [Completeness, Spec §FR-022]
- [x] CHK019 Retry outcome/reschedule với cùng key và payload khác có behavior conflict rõ ràng
  không? [Idempotency, Spec §FR-040]

## Consent, Media, Photo Debt and Tour

- [x] CHK020 Consent có bắt buộc trước upload và ghi đủ method, policy version, actor, server time
  không? [Privacy, Spec §FR-015]
- [x] CHK021 Media validation/lifecycle có nêu content type, size, checksum, READY state và signed
  download scope không? [Security, Spec §FR-016]
- [x] CHK022 ARRIVED thiếu ảnh có tạo đúng một debt/action item nhưng không chặn quầy không?
  [Business rule, Spec §FR-017]
- [x] CHK023 Race giữa arrival, media completion và worker retry có yêu cầu không tạo debt/action
  item/transition trùng không? [Concurrency, Spec §FR-018]
- [x] CHK024 Điều kiện hoàn thành tour có rõ ARRIVED + READY photo + completion data không?
  [Completeness, Spec §FR-019]
- [x] CHK025 Waive debt hoặc correction tour có yêu cầu quyền, reason, audit và không xóa history
  không? [Exception, Data Model §CustomerPhotoDebt]
- [x] CHK026 KPI source có xác định authoritative completion, as-of, correction và không lộ PII/media
  không? [Integration, KPI Adapter Contract]

## Reports, Worker and Chat

- [x] CHK027 Business date/timezone cho 20:08 và 22:00 có rõ khi DST/timezone policy thay đổi
  không? [Edge case, Spec §FR-024..FR-025]
- [x] CHK028 Nội dung hai báo cáo có đủ lịch ngày mai và outcome/reason/photo debt ngày hiện tại
  không? [Completeness, Spec §FR-024..FR-025]
- [x] CHK029 Destination tenant/branch compatibility và behavior khi thiếu channel có rõ không?
  [Failure mode, Spec §FR-026]
- [x] CHK030 Lease, heartbeat, checkpoint, retry, rerun và delivery dedupe có outcome quan sát được
  không? [Reliability, Spec §FR-027..FR-028]
- [x] CHK031 Requirements có ngăn retry tạo trùng chat message, action item, KPI event hoặc history
  không? [Idempotency, Edge Cases]

## XLSX Export

- [x] CHK032 Filter/range/scope export có đủ cụ thể để từ chối toàn bộ yêu cầu chứa branch ngoài
  quyền không? [Security, User Story 5]
- [x] CHK033 XLSX có yêu cầu metadata, timezone, generated-at, stable columns và các data types
  được chọn không? [Completeness, Spec §FR-031]
- [x] CHK034 Formula injection có bao phủ các prefix nguy hiểm và được kiểm thử không?
  [Security, Spec §FR-032]
- [x] CHK035 Job state/progress/checkpoint/retry và bounded dataset có đủ rõ để tránh OOM/transaction
  dài vô hạn không? [Reliability, Spec §FR-033]
- [x] CHK036 Idempotency export có phân biệt same key/same hash và same key/different hash không?
  [Idempotency, Spec §FR-034]
- [x] CHK037 File READY có yêu cầu checksum, byte size, media state và expiry trước khi tải không?
  [Integrity, Data Model §ExportRequest]

## Retention, Audit and Migration

- [x] CHK038 Defaults 180 ngày ảnh, 30 ngày XLSX và 5 năm metadata/audit có nhất quán với PRD không?
  [Consistency, Spec §FR-036]
- [x] CHK039 Policy version/effective-from có bảo toàn lịch sử và không khôi phục binary đã xóa
  không? [Auditability, Spec §FR-037]
- [x] CHK040 Legal hold, tombstone, idempotent deletion và denied download sau deletion có đủ
  acceptance criteria không? [Privacy, Spec §FR-038]
- [x] CHK041 Migration có yêu cầu upgrade từ Module 3, tenant composite FK, conflict constraint,
  seed rerun và restore guidance không? [Migration, Spec §FR-044..FR-045]
- [x] CHK042 Append-only history/audit có actor membership, server time, reason, before/after,
  correlation và policy/form version không? [Auditability, Spec §FR-039]

## Performance and Verification

- [x] CHK043 Capacity 100 tenant, 500 branch, 10.000 users, 20.000 booking/day và 200 req/s có
  measurable gates không? [Performance, Spec §CR-005]
- [x] CHK044 Metrics/log requirements có bao phủ conflict, queue lag, attempt, duration, rows,
  bytes, delivery và safe error code không? [Observability, Spec §CR-005]
- [x] CHK045 Mỗi FR/CR có thể ánh xạ tới unit, contract, integration, isolation/RBAC, migration,
  worker, retention hoặc load verification không? [Traceability, Spec §CR-006]
- [x] CHK046 Quickstart có đủ scenario để nghiệm thu conflict, arrival/debt/tour, report, export,
  retention và local adapters không? [Acceptance coverage, Quickstart]

## Notes

- Checklist này đánh giá chất lượng requirements/artifacts, không đánh giá code implementation.
- Mọi item phải được rà soát và tick trước `$speckit-tasks`; issue phát hiện phải sửa artifact nguồn.
