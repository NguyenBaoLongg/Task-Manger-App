# KPI hằng ngày Adsup

## Thời gian và policy

Policy mặc định mở báo cáo 18:00, đóng 20:00 và đánh giá 20:00:01 theo múi giờ tenant. Khoảng nộp là nửa mở `[18:00, 20:00)`: đúng 20:00 được lưu vào lịch sử nhưng là revision muộn và không thay revision hợp lệ hiện hành.

Mỗi nhân viên chỉ có một cơ sở hiện hành. Branch policy hợp lệ ưu tiên tenant policy; nếu không có cơ sở hoặc có nhiều phân công chồng lấn, worker tạo `DATA_QUALITY` và không đánh giá/không phạt. Policy, target và mapping đều có version cùng khoảng hiệu lực; kết quả đóng ngày giữ ID version đã dùng.

## Quyền

- `kpi.view`: xem KPI, tiến độ và action item cá nhân.
- `kpi.configure`: tạo definition và mapping.
- `kpi.target.manage`: tạo target version.
- `kpi.policy.manage`: tạo policy version tenant/cơ sở.
- `kpi.report.submit`: nộp revision cho chính membership đã xác thực.
- `kpi.evaluation.view`: xem kết quả trong tenant/branch scope được cấp.
- `kpi.evaluation.rerun`: tạo job chạy lại có payload scope và checkpoint.
- `kpi.penalty.adjust`: tạo bút toán điều chỉnh.

Assignment làm việc không tự cấp quyền quản lý. Mọi repository query và unique business key đều có `tenantId`.

## Đánh giá, tiền phạt và sửa sai

Sau hạn, tất cả KPI bắt buộc phải đạt và phải có revision hợp lệ thì ngày mới `PASSED`. Không đạt tạo tối đa một penalty `DAILY_KPI` cho mỗi nhân viên/ngày, mặc định 100.000 VND nhưng lấy từ policy version. Evaluation và penalty gốc là bất biến.

Sửa sai chỉ tạo `PenaltyAdjustment` có delta, lý do, actor, correlation ID, audit và outbox. Repository khóa penalty khi tính số hiệu lực để các correction đồng thời không làm số dư âm. Hoàn ngược toàn bộ chuyển trạng thái sang `FULLY_REVERSED` nhưng không sửa số tiền gốc.

## Realtime và thông báo

- Worker chỉ đánh dấu outbox `SENT` sau khi adapter đích xác nhận. Lỗi được retry theo backoff hữu hạn và cuối cùng chuyển `DEAD_LETTER`.
- Với `REALTIME_BACKPLANE=redis-streams`, worker phát envelope KPI đã giới hạn schema qua Redis; API kiểm tra envelope rồi chỉ emit vào room `tenant + membership`. Dữ liệu authoritative vẫn lấy lại được qua API nếu client mất một sự kiện realtime.
- Local/test dùng adapter memory/noop và collector. Production có thể dùng `PUSH_DRIVER=webhook` để chuyển sự kiện có `Idempotency-Key` cùng Bearer secret sang push relay FCM/APNs mà không đặt credential nhà cung cấp trong worker.

## Action item và evidence

Feed cá nhân có việc thiếu báo cáo, thiếu KPI và nợ ảnh, gồm target/actual/remaining/unit/deadline/source freshness/deep-link. Feed quản lý có lọc branch/department/member/type/state/date, cursor ổn định và tổng hợp chỉ trong scope.

Evidence chỉ bật theo policy. Media được tính khi đúng tenant, owner, report source, purpose và trạng thái `READY`. Reminder, trạng thái quá hạn và photo penalty có khóa idempotent; perceptual-hash fraud decision bị tắt trong MVP.
