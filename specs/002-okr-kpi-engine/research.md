# Research: KPI hằng ngày và việc cần hoàn thành

## R1. Phạm vi sản phẩm

**Decision**: Chỉ triển khai KPI hằng ngày theo PRD. Ba KPI mẫu là doanh số, số nhiệm vụ hoàn thành và
tỷ lệ đi làm đúng giờ. Không triển khai cây OKR, weekly check-in hoặc phát hiện ảnh trùng.

**Rationale**: Đây là ranh giới MVP được xác nhận trong PRD và FR-030. Data model giữ source adapter và
metadata nullable để mở rộng, nhưng không tạo UI/API hành vi chưa được duyệt.

**Alternatives rejected**: Dùng toàn bộ OKR graph trong skill tham chiếu sẽ tăng scope, tạo chu kỳ mà doanh
nghiệp hiện không dùng và mâu thuẫn nguồn sự thật sản phẩm.

## R2. Policy và target có hiệu lực

**Decision**: Policy là immutable version có `effective_from`/`effective_to`, scope `TENANT` hoặc `BRANCH`.
Target cũng là immutable version với precedence `MEMBERSHIP > GROUP > DEPARTMENT > BRANCH > TENANT`, sau
đó ưu tiên `effective_from` mới nhất. Khoảng hiệu lực không được chồng lấp trong cùng natural scope/KPI.

**Rationale**: Cho phép chủ doanh nghiệp sửa trực tiếp và bulk nhiều cơ sở mà vẫn tái hiện đúng ngày cũ.
Evaluation snapshot giữ ID/version đã chọn thay vì truy vấn lại rule hiện hành.

**Alternatives rejected**: Cập nhật tại chỗ làm thay đổi lịch sử; một JSON policy duy nhất trong
`Tenant.settings` không đủ ràng buộc quan hệ, scope, audit hoặc conflict.

## R3. Nhân viên và cơ sở

**Decision**: Tại một business instant, employee phải có đúng một assignment branch hiệu lực. Branch policy
override thắng tenant policy. Không có branch hoặc nhiều branch là job item error có mã ổn định; worker
không tạo daily evaluation/penalty và sinh action item quản trị để sửa dữ liệu.

**Rationale**: Người dùng xác nhận MVP mỗi nhân viên chỉ làm một cơ sở. Fail-safe tránh tính tiền theo phỏng
đoán trong khi schema Module 1 vẫn giữ lịch sử assignment để mở rộng sau này.

**Alternatives rejected**: Chọn branch đầu tiên hoặc branch mới nhất là không xác định và có thể dùng sai mức
phạt; cấm tuyệt đối nhiều assignment ở schema Module 1 sẽ làm mất tính mở rộng/historical overlap cần xử lý.

## R4. Ngày nghiệp vụ và biên 20:00

**Decision**: Policy lưu local time `HH:mm:ss`, IANA timezone và effective business dates. Server chuyển
business date + local time thành UTC instant một lần khi tạo daily work item. Cửa sổ nhận là
`opened_at <= submitted_at < closed_at`; đúng 20:00:00 hoặc sau đó là muộn. Evaluation chỉ claim khi
`now >= evaluation_at` và `evaluation_at > closed_at`.

**Rationale**: PRD nói từ 18:00 đến 20:00 và nộp sau 20:00 không đạt; exclusive upper bound loại bỏ mơ hồ ở
đúng thời điểm đóng. Snapshot instant bảo đảm job retry không bị policy/timezone mới làm lệch.

**Alternatives rejected**: Dùng timezone máy chủ hoặc chỉ lưu UTC time-of-day làm sai tenant khác múi giờ và
không tái hiện thay đổi DST/policy.

## R5. Số học KPI và tiền

**Decision**: VND/tiền được lưu `BigInt` minor units; count là `BigInt`; percentage là `Decimal(9,4)` theo
điểm phần trăm. Direction MVP là `AT_LEAST` hoặc `AT_MOST`. Remaining là `max(target-actual,0)` cho
`AT_LEAST`, `max(actual-target,0)` cho `AT_MOST`; không dùng JavaScript binary float cho tiền.

**Rationale**: Bảo đảm số tiền chính xác, response serialize dưới dạng decimal string và phép tính lịch sử
được tái hiện.

**Alternatives rejected**: `number`/float gây sai số; lưu mọi giá trị trong JSONB làm mất type/index/check.

## R6. Source mapping và report revision

**Decision**: Report header ổn định theo `(tenant, membership, business_date, policy_scope)` và mỗi lần lưu
tạo immutable revision tham chiếu một `FormSubmission` đã validate/publish. Mapping version chỉ đọc JSON
Pointer allow-listed từ form data hoặc source adapter. Snapshot/calculation lưu mapping/target/source ID.

**Rationale**: Tái sử dụng form engine Module 1, không nhân đôi payload; ngăn client ghi đè actual tự động;
cho phép xem revision và nguồn dùng để tính.

**Alternatives rejected**: Chép toàn bộ form vào report làm tăng dữ liệu nhạy cảm; cho client gửi actual phá
vỡ backend authority.

## R7. Đóng ngày, concurrency và khoản phạt duy nhất

**Decision**: `JobRun` có natural key tenant/date/type và lease/checkpoint. Mỗi employee được đánh giá trong
transaction riêng. Unique keys trên evaluation và penalty đảm bảo tối đa một kết quả/khoản phạt. Worker
retry đọc row hiện có và replay; không chạy parallel query trong một Prisma interactive transaction.

**Rationale**: Phục hồi được sau lỗi, giới hạn lock/transaction, xử lý 10.000 employee và ngăn double charge.

**Alternatives rejected**: Một transaction cho toàn tenant giữ lock lâu; chỉ dựa vào queue exactly-once là
không thực tế; application mutex không bảo vệ nhiều replica.

## R8. Điều chỉnh tiền phạt

**Decision**: Penalty outcome bất biến. Correction là append-only `PenaltyAdjustment` với signed delta,
reason, actor và correlation ID. Số hiệu lực = original amount + tổng adjustment, không nhỏ hơn 0. Mọi
adjustment có permission riêng, idempotency và audit/outbox.

**Rationale**: Giữ nguyên bằng chứng quyết định ban đầu nhưng vẫn cho phép sửa lỗi nghiệp vụ có kiểm soát.

**Alternatives rejected**: Sửa amount trực tiếp phá lịch sử; xóa/recreate làm mất liên kết audit/report.

## R9. Nợ ảnh

**Decision**: Chỉ tạo khi policy bật. Required count = số KPI actual được cấu hình cần ảnh + 1 nếu form có
doanh thu. Chỉ `MediaObject` READY, đúng tenant/owner/source/purpose mới được đếm. Debt state machine là
`WAITING_PHOTOS -> SATISFIED | OVERDUE | WAIVED`; reminder/finalization có unique effect key. Grace mặc định
5 phút, photo penalty chỉ tồn tại khi policy có amount rõ.

**Rationale**: Khớp PRD mà không tự suy ra mức phạt hoặc gian lận ảnh. Tận dụng signed media flow/retention.

**Alternatives rejected**: Luôn yêu cầu ảnh hoặc hard-code photo fine là quyết định sản phẩm chưa có; hash
cảm nhận bị loại khỏi MVP.

## R10. Action-item projection và realtime

**Decision**: `ActionItem` là tenant-scoped read model có source key duy nhất; transition là append-only.
Transaction nghiệp vụ upsert trạng thái và ghi outbox. Dispatcher dùng event ID để cập nhật Socket.io/push;
mobile chỉ đọc projection và deep-link, không tự kết luận thiếu việc.

**Rationale**: Một feed thống nhất cho KPI hiện tại và booking/attendance về sau, badge nhanh nhưng PostgreSQL
vẫn authoritative.

**Alternatives rejected**: Tính feed từ nhiều bảng trên mobile gây sai cache/scope; synchronous push trong
transaction có thể mất hiệu ứng hoặc kéo dài lock.

## R11. Outbox và quan sát vận hành

**Decision**: Domain transaction thêm `OutboxEvent` với tenant, aggregate, schema version và dedupe key.
Dispatcher claim bằng lease, retry exponential và đánh dấu sent/dead-letter. Metrics chỉ dùng loại job,
outcome, bucket thời gian; log dùng correlation/event ID và redaction, không label tenant/member.

**Rationale**: Bảo đảm hiệu ứng sau commit có thể retry và scale mà không rò dữ liệu/high-cardinality.

**Alternatives rejected**: Publish trước/ngoài transaction tạo dual-write gap; metrics có tenant ID không
phù hợp capacity và privacy.

## R12. Dependency Module 3

**Decision**: `AttendanceKpiSourcePort` là contract read-only nhận tenant/member/date và trả source snapshot.
Module 2 dùng test double; Module 3 sẽ implement adapter chính thức mà không đổi KPI contract.

**Rationale**: Seed được KPI đúng giờ và test engine ngay, nhưng không sở hữu dữ liệu chấm công trước module.

**Alternatives rejected**: Tạo bảng attendance giả trong Module 2 vi phạm thứ tự dependency và gây migration
trùng lặp.
