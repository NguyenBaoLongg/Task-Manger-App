# Research: Booking và xuất báo cáo

## 1. Chống trùng booking trong concurrency

**Decision**: Dùng service-side precheck để trả lỗi rõ ràng và PostgreSQL partial GiST exclusion
constraint làm guard cuối. Range là `[scheduled_start_at, scheduled_start_at + 60 minutes)`,
partition logic theo tenant + branch + assigned membership; chỉ áp dụng cho type `SCHEDULED` và
status `SCHEDULED`/`ARRIVED`.

**Rationale**: Hai request đồng thời có thể cùng vượt qua `SELECT` rồi insert. Exclusion constraint
giữ invariant ở system of record; range nửa kín cho phép đúng ranh giới 60 phút.

**Alternatives considered**: Chỉ transaction/advisory lock phụ thuộc mọi code path dùng đúng lock;
unique index không biểu diễn khoảng 60 phút; serializable toàn cục tốn retry và vẫn cần mapping lỗi.

## 2. Booking form động

**Decision**: Tái sử dụng `FormTemplate`, immutable published `FormVersion`, `FormSubmission` và AJV
validator của Module 1. Booking giữ composite tenant link tới một submission/version snapshot.

**Rationale**: Tránh tạo schema/form engine thứ hai và giữ contract mobile thống nhất.

**Alternatives considered**: Cột booking cố định không đáp ứng tenant customization; JSONB không
versioned làm dữ liệu lịch sử đổi nghĩa khi form được sửa.

## 3. Customer và branch visibility

**Decision**: Customer thuộc tenant; `CustomerBranchAccess` ánh xạ những cơ sở được phép nhìn hồ sơ.
Booking luôn gắn một branch. Mọi query customer yêu cầu giao của allowed branch IDs với mapping.

**Rationale**: Một khách có thể quay lại ở nhiều cơ sở nhưng PII không được tenant-wide mặc định.

**Alternatives considered**: Customer thuộc riêng một branch gây trùng hồ sơ; tenant-wide visibility
lộ PII cho quản lý không có branch scope.

## 4. Vòng đời booking và reschedule

**Decision**: Booking có `SCHEDULED`, `ARRIVED`, `NO_SHOW`, `CANCELLED`, `RESCHEDULED`; tour
completion là entity riêng. Mọi transition append-only. Reschedule tạo replacement, không đổi start
time của source.

**Rationale**: Report cần phân biệt khách đến với công tour hoàn thành và lịch sử phải giải thích
được sau correction.

**Alternatives considered**: `COMPLETED` trên booking làm mất phân biệt arrival/tour; sửa booking
cũ tại chỗ phá snapshot và audit.

## 5. Consent, ảnh khách và photo debt

**Decision**: Ghi `CustomerPhotoConsent` trước upload intent; media dùng `MediaObject` với purpose
`CUSTOMER_BOOKING_PHOTO`. ARRIVED không bị chặn khi ảnh chưa READY nhưng tạo debt/action item duy
nhất; tour completion bắt buộc READY photo.

**Rationale**: Quầy vẫn ghi nhận khách đến khi mạng/upload chậm, đồng thời nghĩa vụ ảnh không bị
quên và privacy evidence tách khỏi binary.

**Alternatives considered**: Bắt upload xong mới ARRIVED làm nghẽn vận hành; cho hoàn thành tour
khi thiếu ảnh trái PRD.

## 6. Cancellation reason có phiên bản

**Decision**: Mỗi lần sửa tạo version/effective interval mới. Transition lưu version ID và snapshot
code/label; bản vô hiệu không dùng cho mutation mới.

**Rationale**: Report lịch sử không đổi theo tên lý do hiện tại và thay đổi có audit.

**Alternatives considered**: Update row tại chỗ làm lịch sử sai; free text không tổng hợp ổn định.

## 7. Báo cáo 20:08/22:00

**Decision**: Worker scheduler tenant-local claim run bằng lease; report snapshot có hash và mỗi
destination dùng dedupe key `(tenant, branch, reportType, businessDate, destination, revision)`.
Chat message phát qua outbox/adapter hiện có.

**Rationale**: Chạy nhiều worker hoặc retry không gửi trùng, lỗi từng destination quan sát/rerun được.

**Alternatives considered**: Cron process-local dễ bỏ job; gửi chat trong DB transaction giữ lock
lâu và không retry an toàn.

## 8. Native XLSX export

**Decision**: Dùng ExcelJS streaming XLSX writer, keyset pagination và object-storage multipart/file
adapter. Chuỗi bắt đầu `=`, `+`, `-`, `@`, tab hoặc carriage return được prefix dấu nháy đơn. Export
range/scope bị giới hạn và job lưu checkpoint.

**Rationale**: Streaming giữ memory bounded, tạo file gốc có nhiều sheet và chống formula injection.

**Alternatives considered**: CSV không đáp ứng XLSX; tạo workbook in-memory rủi ro OOM; tự viết ZIP/XML
tăng lỗi định dạng. PDF bị loại khỏi MVP.

## 9. Export authorization và retention

**Decision**: Kiểm tra scope khi tạo và kiểm tra lại toàn bộ scope khi cấp download URL. Ảnh khách
mặc định 180 ngày, XLSX 30 ngày; legal hold chặn xóa; deletion tạo tombstone nhưng không xóa audit.

**Rationale**: Quyền có thể thay đổi giữa lúc tạo và tải; binary nhạy cảm không tồn tại vô hạn.

**Alternatives considered**: URL dài hạn dễ bị chia sẻ; chỉ kiểm quyền lúc tạo cho phép tải sau khi
bị thu hồi quyền; hard-delete metadata phá audit.

## 10. Module 2 KPI source

**Decision**: Phát event versioned `booking.tour-completed.v1` và cung cấp repository/service adapter
trả số tour hoàn thành từ authoritative `TourCompletion`. KPI không đọc trực tiếp booking JSON/form.

**Rationale**: Module 2 cần source ổn định, idempotent và không phụ thuộc schema nội bộ Module 4.

**Alternatives considered**: Join trực tiếp bảng nội bộ gây coupling; client gửi KPI actual không có
thẩm quyền.

## 11. Local adapters và observability

**Decision**: Memory/local object storage và chat collectors cho test; production S3/chat adapter giữ
cùng interface. Metrics gồm booking conflict, job claim/attempt/duration/lag, report destinations,
export rows/bytes, retention deleted/held và safe error codes; log redacts PII/object keys.

**Rationale**: Nghiệm thu local không cần credential production nhưng contract vẫn sẵn sàng triển khai.

**Alternatives considered**: Bỏ test khi thiếu cloud credentials tạo critical path mock-only; ghi log
payload đầy đủ làm lộ PII.
