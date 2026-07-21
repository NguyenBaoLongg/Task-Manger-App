# Tích hợp nguồn KPI

Module KPI chỉ đọc số liệu có thẩm quyền qua `KpiSourcePort`. Client mobile không được gửi `actual` để ghi đè kết quả tự động.

Mỗi lần đọc bắt buộc có `tenantId`, `membershipId`, `branchId`, `businessDate`, `kpiCode` và `mappingVersionId`. Adapter trả `value`, `unit`, `observedAt`, `sourceType`, `sourceId` và `inputDigest`; không trả dữ liệu thô không cần thiết. Repository lưu mapping version, source ID, thời điểm quan sát và digest để tái hiện lịch sử.

Module 3 cung cấp adapter `ATTENDANCE_ON_TIME_RATE`. Adapter phải:

- lọc đồng thời tenant, nhân viên, cơ sở và ngày nghiệp vụ;
- chỉ dùng attendance đã được backend xác nhận;
- trả tỷ lệ theo đơn vị `PERCENT` và không làm tròn bằng số thực nhị phân khi lưu;
- trả `null` khi chưa có nguồn, không tự coi thiếu dữ liệu là 0;
- không ghi video, URL ký hoặc metadata nhạy cảm vào log hay outbox.

Form source chỉ đọc JSON Pointer từ đúng form template/version đã publish, đúng người nộp và đúng cơ sở. Source thay đổi tạo calculation event mới cùng `kpi.progress.changed`; event cũ không bị sửa.

Test adapter được phép dùng trong unit/integration. Production không được phụ thuộc Google Sheets, Telegram, Local Storage hoặc dữ liệu client làm nguồn sự thật.
