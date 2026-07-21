# Feature Specification: Nền tảng SaaS đa tenant

**Feature Branch**: `001-multitenant-foundation` (logical feature; Git branch unavailable)

**Created**: 2026-07-19

**Status**: Ready for clarification review

**Input**: Khởi tạo Module 1 cho Adsup: danh tính Google, tenant/cơ sở, thành viên,
phân quyền, biểu mẫu động, media, chat, thông báo và audit làm nền tảng cho các module sau.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Đăng nhập và vào đúng doanh nghiệp (Priority: P1)

Một người dùng đăng nhập bằng Google, xác nhận họ tên bắt buộc, sau đó tạo một doanh
nghiệp mới hoặc tham gia doanh nghiệp hiện có bằng mã/liên kết mời còn hiệu lực. Khi tham
gia nhiều doanh nghiệp, người dùng chọn đúng không gian làm việc trước khi thao tác.

**Why this priority**: Không có danh tính và membership tenant hợp lệ thì không thể cấp
quyền hoặc bảo vệ bất kỳ dữ liệu nghiệp vụ nào.

**Independent Test**: Có thể kiểm thử độc lập bằng một tài khoản Google giả lập: hoàn tất
hồ sơ, tạo tenant, tham gia tenant thứ hai và chứng minh mỗi phiên chỉ truy cập tenant đã chọn.

**Acceptance Scenarios**:

1. **Given** tài khoản Google chưa có hồ sơ Adsup, **When** đăng nhập lần đầu, **Then** hệ
   thống bắt buộc người dùng nhập hoặc xác nhận họ tên trước khi tạo/tham gia tenant.
2. **Given** người dùng đã hoàn tất hồ sơ, **When** tạo tenant, **Then** tenant được tạo một
   lần và người dùng trở thành Tenant Owner có membership hoạt động.
3. **Given** mã mời hợp lệ, chưa bị thu hồi và còn lượt dùng, **When** người dùng chấp nhận,
   **Then** membership được tạo đúng tenant với vai trò/phạm vi đã cấu hình.
4. **Given** người dùng thuộc nhiều tenant, **When** chọn một tenant, **Then** mọi yêu cầu
   sau đó chỉ chạy trong tenant đó và không kế thừa quyền từ tenant khác.
5. **Given** mã mời hết hạn, bị thu hồi, hết lượt hoặc người dùng đã là thành viên, **When**
   chấp nhận mã, **Then** hệ thống trả kết quả an toàn, không tạo membership trùng.

---

### User Story 2 - Quản trị cơ cấu và quyền hạn (Priority: P1)

Tenant Owner quản lý cơ sở, phòng ban, vị trí, thành viên và phân công có thời hạn; tạo vai
trò tùy chỉnh từ permission cho phép và giới hạn quyền theo tenant/cơ sở khi cần.

**Why this priority**: Đây là ranh giới bảo mật và dữ liệu dùng chung của toàn bộ KPI,
chấm công, lịch nghỉ, booking và mobile.

**Independent Test**: Có thể tạo hai tenant, nhiều cơ sở và các vai trò khác nhau; sau đó
chứng minh một manager chỉ quản lý đúng cơ sở được cấp, còn phân công làm việc không tự cấp
quyền quản lý.

**Acceptance Scenarios**:

1. **Given** Tenant Owner đang ở đúng tenant, **When** tạo cơ sở, phòng ban, vị trí và phân
   công nhân viên, **Then** tất cả bản ghi thuộc tenant hiện tại và lưu người thao tác.
2. **Given** một nhân viên thuộc nhiều phòng ban/cơ sở theo các khoảng hiệu lực, **When** xem
   hồ sơ tại một ngày, **Then** hệ thống trả đúng các phân công có hiệu lực và giữ lịch sử cũ.
3. **Given** manager chỉ có quyền tại Cơ sở A, **When** yêu cầu dữ liệu Cơ sở B, **Then** hệ
   thống từ chối mà không tiết lộ việc bản ghi có tồn tại hay không.
4. **Given** hai thao tác đồng thời sửa role hoặc membership, **When** cả hai được xử lý,
   **Then** chỉ trạng thái hợp lệ được chấp nhận và lịch sử không bị ghi đè.
5. **Given** thành viên bị đình chỉ hoặc rời tenant, **When** dùng phiên cũ, **Then** quyền
   truy cập tenant bị vô hiệu hóa dù danh tính Google vẫn hợp lệ.

---

### User Story 3 - Tạo và nộp biểu mẫu động có phiên bản (Priority: P2)

Người có quyền tạo biểu mẫu động, phát hành phiên bản mới và thu thập submission; người nộp
luôn nhìn thấy schema đang áp dụng, còn submission lịch sử giữ nguyên phiên bản đã dùng.

**Why this priority**: Báo cáo công việc, xin nghỉ phép và chấm công của các module tiếp theo
đều cần một nền biểu mẫu dùng chung nhưng không được làm sai lịch sử.

**Independent Test**: Tạo một template, phát hành hai phiên bản có schema khác nhau, nộp dữ
liệu hợp lệ/sai và chứng minh submission cũ vẫn tham chiếu phiên bản đầu.

**Acceptance Scenarios**:

1. **Given** người quản lý có quyền biểu mẫu, **When** phát hành schema hợp lệ, **Then** hệ
   thống tạo phiên bản bất biến mới và ghi audit.
2. **Given** một phiên bản đang có hiệu lực, **When** nhân viên nộp dữ liệu hợp lệ, **Then**
   submission lưu đúng tenant, membership, phiên bản và dữ liệu đã được kiểm tra.
3. **Given** payload không khớp schema, **When** nộp biểu mẫu, **Then** hệ thống từ chối với
   lỗi theo trường và không lưu submission một phần.
4. **Given** template đã có submission, **When** quản lý thay đổi biểu mẫu, **Then** hệ thống
   tạo phiên bản mới thay vì sửa schema cũ.

---

### User Story 4 - Trao đổi và nhận thông báo đúng phạm vi (Priority: P2)

Thành viên trao đổi trong kênh chat nội bộ của tenant/cơ sở/nhóm mà mình được tham gia và
đăng ký thiết bị nhận push. Tên hiển thị đến từ membership nhưng mọi tin nhắn vẫn gắn với
định danh membership ổn định.

**Why this priority**: Các luồng báo đi muộn, nghỉ, lịch khách và duyệt sau này cần kênh
truyền thông tenant-scoped, realtime và có lịch sử.

**Independent Test**: Hai thành viên trong cùng kênh trao đổi gần realtime; thành viên ngoài
kênh hoặc tenant khác không thể xem, gửi hay đăng ký nhận thông báo thay người khác.

**Acceptance Scenarios**:

1. **Given** thành viên thuộc kênh, **When** gửi lại cùng một yêu cầu do retry, **Then** chỉ
   một tin nhắn được lưu và phát tới kênh.
2. **Given** thành viên không thuộc kênh, **When** đọc hoặc gửi tin nhắn, **Then** hệ thống từ
   chối và không phát lộ metadata của kênh.
3. **Given** tên hiển thị membership thay đổi, **When** xem tin nhắn, **Then** hệ thống vẫn
   xác định đúng tác giả và giữ được bằng chứng tên/định danh cần thiết cho lịch sử.
4. **Given** thiết bị được đăng ký hoặc thu hồi, **When** phát thông báo tenant-scoped, **Then**
   chỉ endpoint đang hoạt động của đúng người nhận được chọn.

---

### User Story 5 - Quản lý media và audit nền tảng (Priority: P2)

Người dùng có quyền yêu cầu tải media lên/xuống bằng luồng ký có thời hạn; hệ thống chỉ lưu
metadata có thẩm quyền sau khi xác minh đối tượng, đồng thời cho người quản lý tra cứu lịch
sử các thay đổi quan trọng trong phạm vi được phép.

**Why this priority**: Video check-in, ảnh minh chứng, ảnh khách và chứng từ phạt đều phụ
thuộc một nền media an toàn và audit có thể giải thích.

**Independent Test**: Yêu cầu upload trong đúng tenant, xác nhận object hợp lệ, tải xuống có
quyền; sau đó thử dùng ID từ tenant khác và chứng minh bị từ chối ở mọi bước.

**Acceptance Scenarios**:

1. **Given** actor có quyền với loại media và bản ghi nguồn, **When** yêu cầu upload, **Then**
   nhận quyền tải có thời hạn, ràng buộc tenant, loại nội dung và kích thước cho phép.
2. **Given** object đã được tải lên, **When** hoàn tất upload, **Then** hệ thống xác minh rồi
   mới chuyển metadata sang trạng thái sẵn sàng; retry không tạo media trùng.
3. **Given** actor không có quyền hoặc dùng nguồn thuộc tenant khác, **When** yêu cầu upload
   hay download, **Then** hệ thống từ chối mà không cấp URL có hiệu lực.
4. **Given** một thay đổi đặc quyền đã hoàn tất, **When** người có quyền tra cứu audit, **Then**
   thấy actor, thời gian server, hành động, đối tượng, lý do và trước/sau đã được làm sạch dữ liệu nhạy cảm.

### Edge Cases

- Google xác thực thành công nhưng không trả về tên, email đã đổi hoặc cùng tài khoản đăng
  nhập đồng thời trên nhiều thiết bị.
- Hai yêu cầu tạo tenant/chấp nhận invite dùng cùng idempotency key đến đồng thời.
- Mã mời bị thu hồi đúng lúc một người đang chấp nhận hoặc đạt giới hạn lượt dùng đồng thời.
- Tenant Owner tự đình chỉ membership cuối cùng có quyền quản trị hoặc xóa role đang được dùng.
- Phân công cơ sở/phòng ban có khoảng hiệu lực chồng lấn, kết thúc trước khi bắt đầu, hoặc
  tham chiếu đơn vị đã ngừng hoạt động.
- Client gửi ID hợp lệ về hình thức nhưng thuộc tenant khác ở path, query, body hoặc nested JSON.
- Template phát hành đồng thời hai phiên bản; submission đến đúng thời điểm phiên bản đổi hiệu lực.
- Media upload hết hạn, sai checksum/MIME/kích thước, hoàn tất nhiều lần hoặc object bị thiếu.
- Kết nối realtime mất mạng, kết nối lại và phát lại message; endpoint push trùng hoặc hết hạn.
- Audit payload chứa token, URL ký, dữ liệu nhạy cảm hoặc giá trị quá lớn cần loại bỏ/làm sạch.
- Provider S3, Redis, realtime hoặc push tạm lỗi; dữ liệu có thẩm quyền vẫn nhất quán và tác
  vụ có thể retry mà không nhân đôi hiệu ứng.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST xác thực tài khoản qua Google và ánh xạ ổn định một Google subject
  vào đúng một tài khoản Adsup; không dùng email làm khóa danh tính bất biến.
- **FR-002**: Hệ thống MUST bắt buộc người dùng nhập/xác nhận họ tên trước khi tạo hoặc tham
  gia tenant, kể cả khi Google có cung cấp tên.
- **FR-003**: Hệ thống MUST quản lý phiên truy cập có thể thu hồi và kiểm tra trạng thái tài
  khoản/membership ở các thao tác được bảo vệ.
- **FR-004**: Người dùng MUST có thể tạo nhiều tenant và trở thành Tenant Owner của tenant
  mình tạo; thao tác retry không được tạo tenant hoặc membership trùng.
- **FR-005**: Tenant Owner MUST có thể tạo, giới hạn lượt dùng, đặt hạn và thu hồi mã/liên kết
  mời; việc chấp nhận MUST tạo membership đúng vai trò/phạm vi đã phát hành.
- **FR-006**: Hệ thống MUST hỗ trợ một tài khoản thuộc nhiều tenant và chọn tenant hoạt động
  mà không trộn quyền, cache, chat, media hoặc dữ liệu giữa các tenant.
- **FR-007**: Hệ thống MUST quản lý tenant, cơ sở, phòng ban, vị trí và các trạng thái hoạt
  động/ngừng hoạt động mà không xóa mất lịch sử tham chiếu.
- **FR-008**: Hệ thống MUST quản lý membership, vai trò, permission, role binding và phạm vi
  tenant/cơ sở; phân công làm việc không tự động cấp permission quản lý.
- **FR-009**: Một thành viên MUST có thể có nhiều phân công cơ sở, phòng ban và vị trí với
  khoảng hiệu lực; mọi thay đổi phải giữ lịch sử trước/sau.
- **FR-010**: Mọi quyết định truy cập MUST được tính từ actor đã xác thực, membership hoạt
  động, permission, phạm vi và thời điểm hiệu lực; không tin tenant hoặc actor ID do client tự khai.
- **FR-011**: Hệ thống MUST cung cấp role hệ thống tối thiểu cho Tenant Owner, Manager và
  Employee, đồng thời cho phép tenant tạo role tùy chỉnh từ permission đã công bố.
- **FR-012**: Hệ thống MUST chặn thao tác làm tenant không còn Tenant Owner hoạt động cuối cùng.
- **FR-013**: Hệ thống MUST hỗ trợ template biểu mẫu có bản nháp, phiên bản phát hành bất
  biến, schema hợp lệ, thời điểm hiệu lực và trạng thái ngừng dùng.
- **FR-014**: Hệ thống MUST kiểm tra submission theo đúng schema version, lưu dữ liệu tenant-
  scoped và giữ vĩnh viễn liên kết tới phiên bản đã dùng trong thời gian retention metadata.
- **FR-015**: Hệ thống MUST hỗ trợ ít nhất các trường text, number, boolean, date/time,
  single-select, multi-select và media reference trong schema biểu mẫu MVP.
- **FR-016**: Hệ thống MUST cung cấp kênh chat tenant-scoped với membership kênh, tin nhắn có
  idempotency, lịch sử tác giả và kiểm soát đọc/gửi theo permission/phạm vi.
- **FR-017**: Hệ thống MUST quản lý endpoint push theo tài khoản, thiết bị, nền tảng, trạng
  thái và lần sử dụng; người dùng chỉ đăng ký/thu hồi endpoint của chính mình.
- **FR-018**: Hệ thống MUST quản lý metadata media tenant-scoped và luồng upload/download ký
  có hạn, kiểm tra quyền, nguồn nghiệp vụ, MIME, kích thước, checksum và trạng thái hoàn tất.
- **FR-019**: Hệ thống MUST không lưu binary media trong cơ sở dữ liệu giao dịch và không phát
  lộ credential hay object key có thể đoán giữa các tenant.
- **FR-020**: Hệ thống MUST ghi audit append-only cho đăng nhập nhạy cảm, tenant, invite,
  membership, role, permission, assignment, form version, media và cấu hình hạ tầng quan trọng.
- **FR-021**: Audit MUST lưu actor membership khi có, tenant, thời gian server, correlation ID,
  hành động, loại/ID đối tượng, lý do bắt buộc và before/after đã làm sạch bí mật.
- **FR-022**: Mọi mutation công khai và job retry được MUST có cơ chế idempotency với phạm vi
  tenant/actor/operation phù hợp, phát hiện payload khác dùng lại cùng key.
- **FR-023**: Hệ thống MUST dùng transaction hoặc cơ chế tương đương cho tenant creation,
  invite acceptance, membership/role changes, version publication và media completion.
- **FR-024**: Hệ thống MUST trả lỗi ổn định gồm machine code, thông điệp an toàn và correlation
  ID; lỗi authorization không được tiết lộ sự tồn tại của tài nguyên ngoài phạm vi.
- **FR-025**: Hệ thống MUST cung cấp health/readiness và bằng chứng vận hành đủ để phát hiện
  lỗi API, datastore, worker, realtime và adapter mà không ghi log token hay dữ liệu nhạy cảm.
- **FR-026**: Seed Module 1 MUST tạo idempotently tenant “Công ty TNHH ABC”, nhiều cơ sở,
  khoảng 30 membership, cơ cấu phòng ban/vị trí và role nền để các module sau bổ sung dữ liệu.

### Constitutional & Cross-Cutting Requirements *(mandatory)*

- **CR-001**: Mọi entity tenant-owned trong Module 1 MUST có ranh giới tenant rõ và mọi luồng
  đọc/ghi MUST có acceptance scenario từ chối ID của tenant khác.
- **CR-002**: Mọi thao tác đặc quyền MUST nêu permission và phạm vi tenant/cơ sở; System Admin
  không được ngầm có quyền tenant nếu chưa đi qua cơ chế hỗ trợ được audit.
- **CR-003**: Membership, role binding, assignment, invite, form version và media state MUST
  có lịch sử/audit; mutation và job retry MUST có idempotency và transaction boundary rõ.
- **CR-004**: PII, token, invite secret và signed URL MUST được tối thiểu hóa, làm sạch khỏi
  log/audit và xử lý theo retention; media chỉ được truy cập qua quyết định authorization hiện hành.
- **CR-005**: Module MUST phục vụ mục tiêu 100 tenant, 500 cơ sở, 10.000 tài khoản, 2.000 kết
  nối realtime và 200 yêu cầu/giây mà không dùng các con số này làm hard limit nghiệp vụ.
- **CR-006**: Mỗi FR/CR MUST được ánh xạ trong plan/tasks tới unit, contract, integration,
  tenant-isolation, migration hoặc load verification phù hợp; local test không cần cloud credential thật.

### Key Entities *(include if feature involves data)*

- **User**: Danh tính toàn cục gắn với Google subject, hồ sơ họ tên đã xác nhận và trạng thái tài khoản.
- **Auth Session**: Phiên truy cập/refresh có vòng đời, thu hồi và metadata bảo mật tối thiểu.
- **Tenant**: Doanh nghiệp độc lập, múi giờ, trạng thái và cấu hình nền.
- **Branch**: Cơ sở thuộc đúng một tenant.
- **Department / Position**: Cơ cấu tổ chức tenant-scoped có trạng thái và lịch sử.
- **Tenant Membership**: Liên kết User–Tenant, tên hiển thị, mã nhân viên và trạng thái.
- **Assignment**: Phân công membership vào cơ sở/phòng ban/vị trí theo khoảng hiệu lực.
- **Role / Permission / Role Binding**: Quyền đã công bố, role hệ thống/tùy chỉnh và binding có phạm vi.
- **Invitation**: Mã/liên kết mời đã băm, hạn dùng, số lượt, role/phạm vi và trạng thái thu hồi.
- **Form Template / Form Version**: Định nghĩa biểu mẫu và schema phiên bản bất biến.
- **Form Submission**: Payload đã kiểm tra, người nộp và form version đã dùng.
- **Chat Channel / Channel Membership / Message**: Kênh tenant-scoped, người tham gia và tin nhắn có lịch sử tác giả.
- **Notification Endpoint**: Thiết bị nhận push của một user với trạng thái và nền tảng.
- **Media Object**: Metadata, nguồn nghiệp vụ, checksum, loại nội dung, kích thước và vòng đời upload.
- **Audit Event**: Bản ghi append-only về actor, tenant, hành động, đối tượng và thay đổi đã làm sạch.
- **Idempotency Record**: Khóa chống hiệu ứng trùng, fingerprint request và kết quả có thời hạn.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ít nhất 95% người dùng thử nghiệm hoàn tất đăng nhập, xác nhận họ tên và tạo
  hoặc tham gia tenant trong dưới 2 phút mà không cần hỗ trợ.
- **SC-002**: 100% kịch bản truy cập chéo tenant trong bộ kiểm thử bị từ chối và không trả về
  dữ liệu, metadata tồn tại hay quyền truy cập media/realtime của tenant khác.
- **SC-003**: Mọi retry có cùng idempotency key trong các luồng tạo tenant, chấp nhận invite,
  gửi message, nộp form và hoàn tất media tạo đúng một hiệu ứng nghiệp vụ.
- **SC-004**: 100% thay đổi membership, quyền, assignment, form version và media state có thể
  truy ra actor, thời gian, tenant, correlation và trước/sau theo yêu cầu audit.
- **SC-005**: Tenant mẫu có thể seed lại ít nhất ba lần liên tiếp mà số tenant, membership,
  cơ sở, phòng ban, vị trí và role không tăng ngoài dữ liệu mong đợi.
- **SC-006**: 100% contract được công bố có kiểm tra success, validation, authentication,
  authorization, conflict/idempotency và lỗi an toàn trước khi Module 1 được đóng.
- **SC-007**: Hệ thống duy trì chức năng chính ở tải mục tiêu 200 yêu cầu/giây và 2.000 kết
  nối realtime đồng thời; p95 của thao tác API không-media dưới 500 ms trong môi trường load test chuẩn.
- **SC-008**: Toàn bộ unit, contract, integration, tenant-isolation, migration, typecheck,
  lint và build chạy được cục bộ/CI mà không cần credential AWS, FCM hoặc APNs thật.

## Assumptions

- Google OAuth là phương thức đăng nhập duy nhất của người dùng nội bộ trong MVP; test dùng
  verifier/provider giả lập tương thích cùng contract.
- Invite hỗ trợ cả mời trực tiếp một lượt và link nhóm nhiều lượt có giới hạn; mặc định an
  toàn là một lượt nếu người tạo không chỉ định.
- Tên hiển thị membership mặc định lấy từ họ tên đã xác nhận nhưng có thể được người có quyền
  sửa; định danh nghiệp vụ luôn dựa trên membership ID.
- System Admin chỉ quản trị nền tảng. Truy cập hỗ trợ vào tenant, nếu được bổ sung, phải là
  luồng riêng có thời hạn, lý do và audit; không thuộc các user story của Module 1.
- Module 1 tạo nền dữ liệu và adapter cho media/push/realtime; xử lý video, KPI, chấm công,
  booking, penalty và giao diện mobile thuộc các module sau.
- Dữ liệu seed của Module 1 chỉ gồm danh tính/cơ cấu/quyền; form nghiệp vụ chi tiết, ca làm,
  KPI và booking mẫu sẽ được module sở hữu tương ứng bổ sung idempotently.
- Tài khoản cloud production, cấu hình DNS/CDN và triển khai production thật nằm ngoài phạm
  vi local implementation; interface và cấu hình môi trường production-ready vẫn nằm trong phạm vi.
