# Feature Specification: Booking và xuất báo cáo

**Feature Branch**: `004-booking-export`

**Created**: 2026-07-24

**Status**: Draft

**Input**: Hoàn thành Module 4 từ `docs/PRODUCT_REQUIREMENTS_MVP.md`, constitution,
artifacts Module 1-3 và reference của `$build-booking-export`. Phạm vi gồm dynamic booking
forms, lịch hẹn và chống trùng trong một giờ, cancellation reasons theo tenant, ARRIVED và
photo debt, báo cáo PostgreSQL tenant-scoped, export file, RBAC, audit, idempotency,
migration, worker retry và tests. Không làm mobile UI trong Module 4.

## Clarifications

### Session 2026-07-24

- Q: Module 4 MVP có triển khai PDF export khi yêu cầu điều phối ghi XLSX/PDF nhưng PRD xác định
  PDF ngoài MVP không? → A: Không. MVP chỉ triển khai XLSX; PDF được giữ là điểm mở rộng sau MVP
  và không có task implementation trong Module 4.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tạo lịch hẹn đúng cơ sở và không trùng nhân sự (Priority: P1)

Nhân viên nội bộ có quyền tạo hoặc chỉnh sửa lịch hẹn cho khách tại một cơ sở, chọn dịch vụ đang
có hiệu lực tại cơ sở,
nhân viên phụ trách và điền biểu mẫu booking động đang có hiệu lực. Hệ thống chỉ nhận lịch khi
khách, dịch vụ, nhân viên và biểu mẫu đều thuộc đúng tenant/cơ sở, đồng thời giờ bắt đầu của hai
lịch đang hoạt động của cùng một nhân viên tại cùng cơ sở cách nhau ít nhất 60 phút.

**Why this priority**: Đây là luồng tạo dữ liệu gốc cho vận hành lịch khách, công tour, báo cáo
cuối ngày và ứng dụng mobile ở Module 5.

**Independent Test**: Tạo lịch cho một khách và nhân viên hợp lệ, sau đó thử tạo hai lịch cách
nhau 59 và 60 phút để chứng minh hệ thống từ chối đúng trường hợp xung đột và chấp nhận đúng
ranh giới.

**Acceptance Scenarios**:

1. **Given** người dùng có quyền tạo booking tại cơ sở A và nhân viên phụ trách đang được phân
   công tại cơ sở A, **When** người dùng gửi dữ liệu hợp lệ cùng biểu mẫu booking đã publish,
   **Then** booking được tạo với tenant, cơ sở, khách, dịch vụ, nhân viên, phiên bản biểu mẫu,
   người tạo và thời gian máy chủ.
2. **Given** nhân viên đã có một booking đang hoạt động lúc 09:00 tại cơ sở A, **When** một yêu
   cầu khác đặt cùng nhân viên lúc 09:59, **Then** hệ thống từ chối do xung đột và không tạo bản
   ghi một phần.
3. **Given** nhân viên đã có một booking đang hoạt động lúc 09:00, **When** một booking khác bắt
   đầu lúc 10:00, **Then** hệ thống chấp nhận nếu mọi điều kiện khác hợp lệ.
4. **Given** hai yêu cầu đồng thời cố đặt cùng nhân viên vào các giờ cách nhau dưới 60 phút,
   **When** cả hai được xử lý, **Then** tối đa một yêu cầu thành công và lịch không rơi vào trạng
   thái xung đột.
5. **Given** hai nhân viên khác nhau tại cùng cơ sở, **When** họ được đặt lịch cùng thời điểm,
   **Then** cả hai lịch có thể được chấp nhận.
6. **Given** booking đã bị `CANCELLED`, `NO_SHOW` hoặc được thay thế bởi một lần reschedule,
   **When** tạo booking mới tại cùng thời điểm, **Then** booking kết thúc đó không chiếm khoảng
   cách 60 phút.

---

### User Story 2 - Ghi nhận khách đến và quản lý photo debt (Priority: P1)

Khi khách đến, nhân viên được phép chuyển booking sang `ARRIVED` sau khi ghi nhận consent chụp
hoặc tải ảnh. Nếu ảnh bắt buộc chưa sẵn sàng, hệ thống vẫn ghi nhận khách đến nhưng tạo một photo
debt có thể truy vết; công tour chỉ được hoàn thành khi có dữ liệu hoàn thành hợp lệ và ảnh khách
đã sẵn sàng.

**Why this priority**: Trạng thái khách đến, ảnh khách và công tour là dữ liệu vận hành bắt buộc
cho KPI, action item và báo cáo cuối ngày.

**Independent Test**: Chuyển một booking sang `ARRIVED` khi chưa có ảnh để tạo debt, hoàn tất
upload ảnh hợp lệ để đóng debt, rồi hoàn thành công tour mà không làm mất lịch sử consent hay
chuyển trạng thái.

**Acceptance Scenarios**:

1. **Given** booking hợp lệ và khách đã đồng ý chụp/tải ảnh, **When** nhân viên ghi nhận
   `ARRIVED`, **Then** hệ thống lưu phương thức consent, phiên bản chính sách, người thao tác,
   thời gian máy chủ và trạng thái khách đến.
2. **Given** booking chuyển sang `ARRIVED` nhưng chưa có ảnh khách ở trạng thái sẵn sàng,
   **When** giao dịch hoàn tất, **Then** hệ thống tạo đúng một photo debt mở và action item tương
   ứng cho người chịu trách nhiệm.
3. **Given** photo debt đang mở, **When** ảnh khách hợp lệ được upload hoàn tất và gắn đúng
   booking/công tour, **Then** debt và action item được đóng idempotent, còn lịch sử vẫn được giữ.
4. **Given** booking đã `ARRIVED` nhưng thiếu ảnh hoặc dữ liệu hoàn thành tour,
   **When** người dùng yêu cầu hoàn thành công tour, **Then** hệ thống từ chối và nêu điều kiện
   còn thiếu.
5. **Given** booking kiểu `WALK_IN`, **When** khách đến ngay, **Then** hệ thống tạo booking với
   giờ máy chủ hiện tại, chuyển ngay sang `ARRIVED`, bỏ qua kiểm tra khoảng cách 60 phút nhưng vẫn
   áp dụng consent, ảnh khách, photo debt và điều kiện hoàn thành tour.

---

### User Story 3 - Quản lý kết quả lịch hẹn và lý do hủy (Priority: P1)

Người có quyền cập nhật kết quả booking thành khách đến, không đến, hủy hoặc đổi lịch. Tenant
Owner quản lý danh sách lý do hủy/đổi lịch dùng trong tenant. Mỗi thay đổi trạng thái phải giữ
lịch sử actor, thời gian, lý do và bằng chứng liên quan; reschedule tạo lịch thay thế thay vì ghi
đè lịch cũ.

**Why this priority**: Báo cáo lúc 22:00 và việc xử lý booking tồn đọng chỉ chính xác khi mọi kết
quả đều có nguồn và lịch sử kiểm tra được.

**Independent Test**: Cấu hình lý do hủy, hủy một booking, đổi lịch một booking khác và xác nhận
lịch cũ/lịch mới, liên kết reschedule, action item và lịch sử trạng thái đều nhất quán.

**Acceptance Scenarios**:

1. **Given** Tenant Owner tạo một lý do hủy đang hiệu lực, **When** nhân viên có quyền hủy booking
   chọn lý do đó, **Then** booking chuyển sang `CANCELLED` và lưu snapshot lý do đã dùng.
2. **Given** lý do hủy đã bị vô hiệu hóa sau khi từng được sử dụng, **When** xem booking lịch sử,
   **Then** tên/mã lý do tại thời điểm hủy vẫn hiển thị đúng và lý do đó không xuất hiện cho giao
   dịch mới.
3. **Given** booking cần đổi lịch, **When** người dùng chọn giờ mới hợp lệ và nhập lý do,
   **Then** hệ thống kết thúc booking cũ, tạo booking mới có liên kết hai chiều và kiểm tra xung
   đột cho lịch mới trong cùng một giao dịch nghiệp vụ.
4. **Given** booking quá hạn chưa có trạng thái kết quả, **When** worker đối soát chạy,
   **Then** hệ thống tạo đúng một action item tenant/branch-scoped có deep link tới booking nguồn.
5. **Given** người dùng chỉ có quyền tại cơ sở A, **When** cố xem hoặc thay đổi booking, khách,
   ảnh hoặc lý do thuộc cơ sở B ngoài phạm vi, **Then** hệ thống từ chối mà không tiết lộ dữ liệu.

---

### User Story 4 - Nhận báo cáo lịch khách tự động theo cơ sở (Priority: P2)

Quản lý nhận báo cáo lịch ngày mai lúc 20:08 và báo cáo kết quả ngày hiện tại lúc 22:00 theo múi
giờ tenant. Báo cáo được tổng hợp từ dữ liệu có thẩm quyền, tách theo tenant/cơ sở, có thể nhóm
theo nhân viên phụ trách và được đăng vào kênh chat nội bộ đã cấu hình.

**Why this priority**: Hai báo cáo giúp cơ sở chuẩn bị lịch hôm sau và chốt các booking còn thiếu
trạng thái/ảnh mà không phụ thuộc bảng tính ngoài hệ thống.

**Independent Test**: Chạy hai job cho một ngày nghiệp vụ có dữ liệu ở hai tenant và nhiều cơ sở,
xác nhận nội dung/scope đúng, retry không đăng trùng và lỗi gửi có thể chạy lại an toàn.

**Acceptance Scenarios**:

1. **Given** tenant có lịch ngày mai tại nhiều cơ sở, **When** đến 20:08 theo múi giờ tenant,
   **Then** mỗi đích nhận cấu hình được đăng snapshot lịch ngày mai đúng scope và trạng thái hiện
   tại.
2. **Given** ngày hiện tại có booking `ARRIVED`, `NO_SHOW`, `CANCELLED`, rescheduled và booking
   thiếu ảnh, **When** đến 22:00, **Then** báo cáo gồm số booking, khách đến, công tour hoàn thành,
   từng kết quả, nhóm lý do và số ảnh còn thiếu.
3. **Given** lần gửi đầu thất bại tạm thời, **When** worker retry hoặc quản trị viên rerun,
   **Then** cùng một báo cáo không bị nhân đôi và kết quả từng lần chạy được ghi nhận.
4. **Given** tenant không cấu hình kênh chat hợp lệ cho một scope, **When** job chạy,
   **Then** hệ thống ghi lỗi có thể hành động, không gửi sang tenant/cơ sở khác và cho phép sửa
   cấu hình rồi rerun.

---

### User Story 5 - Tạo và tải báo cáo vận hành gốc (Priority: P2)

Người có quyền chọn khoảng ngày, tenant/cơ sở được phép quản lý và loại dữ liệu cần xuất. Hệ
thống lấy dữ liệu trực tiếp từ nguồn có thẩm quyền, tạo file XLSX có cấu trúc, lưu file trong thời
hạn cho phép và cung cấp lượt tải có kiểm soát.

**Why this priority**: Báo cáo gốc giúp đối soát booking, KPI và tiền phạt mà không biến Google
Sheets hoặc dữ liệu trên thiết bị thành hệ thống nguồn.

**Independent Test**: Yêu cầu một export nhiều cơ sở trong phạm vi quyền, chờ worker tạo XLSX,
tải file và đối chiếu số liệu với dữ liệu nguồn; đồng thời chứng minh người ngoài scope không thể
yêu cầu hoặc tải file.

**Acceptance Scenarios**:

1. **Given** quản lý có quyền tại cơ sở A nhưng không có quyền tại cơ sở B, **When** yêu cầu export
   cả hai cơ sở, **Then** hệ thống từ chối toàn bộ yêu cầu và không âm thầm bỏ bớt dữ liệu.
2. **Given** yêu cầu export hợp lệ, **When** worker xử lý, **Then** file XLSX chứa metadata báo
   cáo, bộ lọc, thời điểm tạo và các bảng dữ liệu đã chọn với tên cột ổn định.
3. **Given** cùng khóa idempotency và cùng nội dung yêu cầu được gửi lại, **When** hệ thống tiếp
   nhận, **Then** trả lại cùng export job hoặc kết quả mà không tạo file trùng.
4. **Given** dữ liệu chứa chuỗi bắt đầu bằng ký tự có thể được bảng tính hiểu là công thức,
   **When** tạo XLSX, **Then** giá trị được xuất an toàn dưới dạng dữ liệu và không tự thực thi.
5. **Given** file export đã hết hạn lưu và không có legal hold, **When** tiến trình retention chạy,
   **Then** binary bị xóa, tombstone/audit còn lại và lượt tải mới bị từ chối.

---

### User Story 6 - Quản trị cấu hình booking có phiên bản (Priority: P2)

Tenant Owner cấu hình biểu mẫu booking, danh mục dịch vụ theo cơ sở, chính sách consent ảnh khách,
danh sách lý do hủy/đổi lịch, kênh nhận báo cáo và chính sách lưu ảnh khách/file export. Cấu hình
mới chỉ áp dụng từ thời điểm hiệu lực và không làm thay đổi cách diễn giải dữ liệu lịch sử.

**Why this priority**: Mỗi tenant có quy trình vận hành khác nhau nhưng mọi thay đổi phải có thể
kiểm tra và rollback bằng phiên bản mới thay vì sửa mất lịch sử.

**Independent Test**: Publish một phiên bản cấu hình, tạo booking sử dụng phiên bản đó, publish
phiên bản kế tiếp và xác nhận booking cũ vẫn tham chiếu snapshot/phiên bản ban đầu.

**Acceptance Scenarios**:

1. **Given** biểu mẫu booking mới còn ở bản nháp, **When** Tenant Owner publish,
   **Then** biểu mẫu trở thành phiên bản hiện hành cho booking mới và phiên bản đã publish là bất
   biến.
2. **Given** chính sách retention mới có ngày hiệu lực trong tương lai, **When** xem dữ liệu trước
   và sau mốc đó, **Then** mỗi bản ghi tham chiếu đúng policy version áp dụng tại thời điểm tạo.
3. **Given** một media/file đang có legal hold, **When** hết thời hạn retention,
   **Then** hệ thống không xóa binary cho tới khi legal hold được gỡ bằng thao tác có quyền và
   audit.

### Edge Cases

- Thời điểm 20:08, 22:00 và ngày nghiệp vụ phải xử lý đúng múi giờ tenant, ngày chuyển múi giờ và
  thay đổi timezone có hiệu lực mà không chạy/gửi trùng.
- Booking nằm đúng ranh giới 60 phút được chấp nhận; dưới 60 phút dù chỉ một giây phải bị từ chối.
- Hai booking khác cơ sở nhưng cùng nhân viên không được tạo nếu nhân viên không có phân công hợp
  lệ tại cơ sở/thời điểm tương ứng; không tự suy diễn quyền hoặc phân công.
- Booking không được tham chiếu khách, nhân viên, dịch vụ, form version, media, cancellation
  reason hoặc chat channel của tenant khác.
- Yêu cầu idempotent được gửi lại với cùng key nhưng payload khác phải trả xung đột ổn định.
- Upload ảnh hoàn tất sau khi booking đã bị hủy phải không tự chuyển booking sang `ARRIVED` hoặc
  đóng debt không còn hợp lệ.
- Retry worker sau khi file/report đã hoàn thành phải dùng checkpoint và dedupe key, không tạo
  thêm file, chat message, action item hoặc history transition.
- File export quá lớn phải bị từ chối trước hoặc chia theo giới hạn công bố; không giữ transaction
  đọc dài vô hạn và không tạo file hỏng.
- Dữ liệu bị xóa theo retention phải không thể khôi phục từ API; legal hold phải chặn xóa nhưng
  không cấp thêm quyền đọc.
- Việc vô hiệu hóa lý do hủy không được làm mất snapshot trên booking lịch sử.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST chỉ cho nhân viên nội bộ đã xác thực và có permission phù hợp tạo,
  xem, sửa, chuyển trạng thái hoặc xuất booking; khách hàng không đăng nhập và không tự đặt lịch
  trong MVP.
- **FR-002**: Hệ thống MUST lưu hồ sơ khách tối thiểu theo tenant và áp dụng branch-scoped
  visibility cho mọi thao tác đọc/ghi.
- **FR-003**: Booking MUST thuộc đúng một tenant, một cơ sở, một khách, một dịch vụ và một nhân
  viên phụ trách đang có phân công hợp lệ tại cơ sở vào thời điểm lịch hẹn.
- **FR-004**: Dịch vụ MAY được cung cấp ở nhiều cơ sở, nhưng một booking không được trộn khách,
  nhân viên, dịch vụ, form hoặc media ngoài tenant/cơ sở hợp lệ.
- **FR-005**: Booking theo lịch MUST lưu giờ bắt đầu, ngày nghiệp vụ, múi giờ/snapshot thời gian,
  loại booking, trạng thái hiện hành, actor tạo và thời gian máy chủ.
- **FR-006**: Hệ thống MUST dùng FormTemplate/FormVersion đã publish của Module 1 cho biểu mẫu
  booking động và lưu submission bất biến gắn với đúng booking/form version.
- **FR-007**: Hệ thống MUST validate dữ liệu booking theo JSON Schema của đúng FormVersion và từ
  chối field không được schema hỗ trợ.
- **FR-008**: Hai booking theo lịch đang hoạt động của cùng nhân viên tại cùng cơ sở MUST có giờ
  bắt đầu cách nhau ít nhất 60 phút.
- **FR-009**: Booking `CANCELLED`, `NO_SHOW` và booking cũ đã được thay thế bởi reschedule MUST
  không tiếp tục chiếm khoảng cách 60 phút.
- **FR-010**: Kiểm tra và ghi booking MUST là một thao tác nguyên tử có khả năng chống hai yêu cầu
  đồng thời cùng vượt qua kiểm tra xung đột.
- **FR-011**: Booking kiểu `WALK_IN` MUST dùng giờ máy chủ hiện tại, chuyển ngay sang `ARRIVED`,
  không được đặt cho tương lai và được miễn kiểm tra khoảng cách 60 phút.
- **FR-012**: Loại booking MUST bất biến sau khi tạo, ngoại trừ correction của quản trị viên có
  permission, lý do bắt buộc và audit trước/sau.
- **FR-013**: Hệ thống MUST hỗ trợ vòng đời booking tối thiểu gồm lịch đang hoạt động,
  `ARRIVED`, `NO_SHOW`, `CANCELLED` và trạng thái kết thúc do reschedule.
- **FR-014**: Mọi state transition MUST kiểm tra transition hợp lệ, optimistic/concurrency
  conflict và không được silently coerce trạng thái.
- **FR-015**: Trước khi chụp hoặc tải ảnh khách, hệ thống MUST ghi nhận consent gồm phương thức,
  policy version, actor membership và thời gian máy chủ.
- **FR-016**: Ảnh khách MUST dùng media lifecycle có kiểm tra content type, kích thước, checksum,
  trạng thái upload và quyền tải bằng URL ngắn hạn; binary không được lưu trong dữ liệu nghiệp vụ.
- **FR-017**: Khi booking `ARRIVED` chưa có ảnh khách bắt buộc ở trạng thái sẵn sàng, hệ thống
  MUST tạo đúng một photo debt tenant/branch-scoped và action item có deep link tới nguồn.
- **FR-018**: Khi ảnh hợp lệ được hoàn tất, hệ thống MUST đóng photo debt và action item
  idempotent mà không xóa lịch sử.
- **FR-019**: Công tour MUST chỉ được hoàn thành khi booking đã `ARRIVED`, có dữ liệu hoàn thành
  hợp lệ và đủ ảnh khách bắt buộc.
- **FR-020**: Tenant Owner MUST cấu hình được danh sách cancellation/reschedule reasons theo
  tenant với mã, nhãn, trạng thái và thời gian hiệu lực.
- **FR-021**: Booking kết thúc do hủy, không đến hoặc reschedule MUST lưu reason code cùng snapshot
  hiển thị, actor, thời gian và bằng chứng liên quan.
- **FR-022**: Reschedule MUST giữ booking cũ, tạo booking mới, liên kết lịch sử hai bản ghi và áp
  dụng lại mọi kiểm tra scope/xung đột cho lịch mới.
- **FR-023**: Hệ thống MUST tạo action item cho booking quá hạn thiếu trạng thái, booking
  `ARRIVED` thiếu ảnh và công tour chưa hoàn thành; việc tạo/đóng MUST idempotent.
- **FR-024**: Lúc 20:08 hằng ngày theo múi giờ tenant, hệ thống MUST tạo snapshot lịch ngày hôm
  sau, tách tenant/cơ sở và có thể nhóm theo nhân viên phụ trách.
- **FR-025**: Lúc 22:00 hằng ngày theo múi giờ tenant, hệ thống MUST tổng hợp số booking, khách
  đến, công tour hoàn thành, `NO_SHOW`, `CANCELLED`, rescheduled, nhóm lý do và ảnh còn thiếu của
  ngày hiện tại.
- **FR-026**: Tenant Owner MUST cấu hình đích chat nội bộ cho báo cáo theo tenant/cơ sở; hệ thống
  MUST xác thực channel cùng tenant và phù hợp scope trước khi gửi.
- **FR-027**: Mỗi report job/run MUST lưu tenant, scope cơ sở, business date, loại báo cáo, input
  snapshot/checkpoint, số lần thử, trạng thái và kết quả gửi an toàn để quan sát.
- **FR-028**: Scheduled report MUST có dedupe key; retry/rerun không được đăng trùng cùng báo cáo
  vào cùng đích trừ khi quản trị viên yêu cầu một bản gửi lại có audit rõ ràng.
- **FR-029**: Người có quyền MUST yêu cầu export theo khoảng ngày, loại dữ liệu và một hay nhiều
  cơ sở nằm trọn trong phạm vi quản lý.
- **FR-030**: Export MUST đọc dữ liệu có thẩm quyền từ hệ thống, không phụ thuộc Google Sheets,
  browser local storage hoặc dữ liệu do mobile tự tổng hợp.
- **FR-031**: MVP MUST tạo XLSX gốc có metadata, filter, generated-at, timezone, tiêu đề cột ổn
  định và các sheet/bảng tương ứng với loại dữ liệu được chọn.
- **FR-032**: XLSX MUST trung hòa giá trị người dùng có thể gây spreadsheet formula injection.
- **FR-033**: Export MUST được xử lý bất đồng bộ, có trạng thái, tiến độ/checkpoint, giới hạn
  phạm vi dữ liệu, retry có backoff và lỗi an toàn cho người dùng.
- **FR-034**: Mỗi export request MUST hỗ trợ idempotency; cùng key/cùng payload trả cùng kết quả,
  cùng key/khác payload trả conflict.
- **FR-035**: Chỉ người còn quyền với toàn bộ scope export tại thời điểm tải mới được nhận URL tải
  ngắn hạn; quyền tạo file trước đó không bảo đảm quyền tải vĩnh viễn.
- **FR-036**: Ảnh khách MUST có retention mặc định 180 ngày và file XLSX mặc định 30 ngày; metadata
  nghiệp vụ/audit không chứa binary MUST giữ 5 năm.
- **FR-037**: Tenant Owner MUST cấu hình retention trong giới hạn nền tảng bằng policy version có
  `effective_from`, actor và audit; thay đổi không được tự khôi phục binary đã xóa.
- **FR-038**: Retention worker MUST hỗ trợ legal hold, tombstone, retry idempotent và từ chối tải
  sau khi binary đã bị xóa.
- **FR-039**: Hệ thống MUST giữ append-only history cho booking transition, reschedule, consent,
  photo debt, cancellation reason version, report run, export run và privileged correction.
- **FR-040**: Mọi mutation có thể retry MUST có idempotency boundary tenant + actor + operation và
  request hash; event phát ra MUST dùng transactional outbox/dedupe consumer.
- **FR-041**: Module 4 MUST cung cấp event/contract ổn định cho Module 2 lấy số công tour hoàn
  thành, booking outcome và photo debt mà không truy cập bảng nội bộ không có contract.
- **FR-042**: Module 4 MUST giữ compatibility với auth, tenant context, RBAC, audit, dynamic form,
  media, chat, action item, KPI source và penalty ledger contracts đã ổn định ở Module 1-3.
- **FR-043**: Mọi danh sách booking, customer, reason, report và export MUST dùng phân trang/bộ lọc
  có giới hạn và thứ tự ổn định.
- **FR-044**: Hệ thống MUST seed và verify tenant mẫu có booking form version, cancellation
  reasons, report destinations, retention policy, khách, dịch vụ và lịch mẫu đủ để nghiệm thu
  local.
- **FR-045**: Module 4 MUST có migration forward, verification và rollback/restore guidance cho
  schema/index/constraint mới mà không làm hỏng dữ liệu Module 1-3.
- **FR-046**: Mobile UI, customer self-booking, payment/payroll, room/equipment/bed conflict,
  electronic customer signature và Google Sheets làm nguồn dữ liệu MUST nằm ngoài Module 4.
- **FR-047**: Module 4 MVP MUST chỉ triển khai XLSX; PDF export MUST nằm ngoài phạm vi
  implementation và chỉ được giữ như một điểm mở rộng sau MVP.
- **FR-048**: Người có quyền MUST xem được danh mục dịch vụ đang hiệu lực trong các cơ sở thuộc
  scope; Tenant Owner MUST cấu hình dịch vụ và phạm vi cơ sở bằng phiên bản/effective interval để
  booking lịch sử giữ đúng service snapshot.
- **FR-049**: Hệ thống MUST ghi consent trước khi tạo customer-photo upload intent. Upload intent
  MUST tham chiếu consent và booking cùng tenant/cơ sở; arrival/tour chỉ chấp nhận media từ luồng
  consent này.
- **FR-050**: Tenant Owner MUST quản lý chính sách consent ảnh khách bằng phiên bản bất biến có nội
  dung hiển thị, thời gian hiệu lực và audit; nhân viên MUST lấy/xác nhận đúng phiên bản hiệu lực
  trước khi ghi consent.

### Constitutional & Cross-Cutting Requirements *(mandatory)*

- **CR-001**: Mọi entity, repository query, unique constraint, foreign key logic, cache key,
  object key, job, event và log nghiệp vụ của Module 4 MUST mang tenant context. Contract và test
  MUST chứng minh cross-tenant ID trả kết quả không tiết lộ sự tồn tại và không có đường dẫn đọc
  hoặc ghi bỏ qua tenant.
- **CR-002**: Contract MUST nêu permission và tenant/branch scope cho từng action: quản lý khách,
  booking, outcome, tour, reasons, report destination, export, retention/legal hold và correction.
  Tenant assignment không tự cấp quyền quản lý branch.
- **CR-003**: Booking create/reschedule/outcome, ARRIVED/photo debt, tour completion, export claim
  và report send MUST có transaction/concurrency/idempotency strategy. Lịch sử và audit phải giữ
  actor membership ổn định, server time, correlation ID, reason, before/after redacted và policy
  hoặc form version.
- **CR-004**: Customer PII, consent, ảnh khách và file export MUST có validation, least-privilege
  download, log redaction, retention, tombstone, legal hold và recovery expectation. Test không
  được dùng credential production hoặc đưa binary/PII vào log.
- **CR-005**: Module MUST phục vụ mục tiêu 100 tenant, 500 cơ sở, 10.000 người dùng, 20.000
  booking/ngày và tải API tổng 200 request/giây. Luồng tương tác thông thường phải phản hồi trong
  2 giây ở tải mục tiêu; job phải có metrics cho queue lag, attempt, duration, rows/files,
  conflict, send result và safe error code.
- **CR-006**: FR-001..FR-050 và CR-001..CR-005 MUST được ánh xạ trong plan/tasks tới unit,
  contract, migration, integration, tenant-isolation/RBAC, concurrency/idempotency, worker
  retry, privacy/retention, load và end-to-end verification phù hợp; chỉ mark hoàn thành khi
  verification tương ứng pass.

### Key Entities *(include if feature involves data)*

- **Customer**: Hồ sơ khách tối thiểu thuộc tenant, có phạm vi hiển thị theo cơ sở và lịch sử
  thay đổi PII cần audit.
- **ServiceOffering**: Dịch vụ tenant cung cấp, có thể được bật tại nhiều cơ sở và dùng để phân
  loại booking/công tour.
- **Booking**: Lịch khách tenant/branch-scoped, gắn khách, dịch vụ, nhân viên, thời gian, loại,
  trạng thái, dynamic form submission và liên kết reschedule.
- **BookingStatusTransition**: Lịch sử append-only của thay đổi trạng thái, reason snapshot,
  actor, server time, evidence và correlation.
- **BookingCancellationReasonVersion**: Danh mục lý do có phiên bản, hiệu lực và trạng thái theo
  tenant.
- **CustomerPhotoConsent**: Bằng chứng consent trước media, gắn booking/tour, khách, actor, policy
  version, phương thức và thời gian.
- **CustomerPhotoConsentPolicyVersion**: Nội dung/chính sách consent ảnh khách bất biến theo tenant
  với phiên bản, hiệu lực, actor và audit.
- **CustomerPhotoDebt**: Nghĩa vụ ảnh phát sinh khi khách đã đến nhưng thiếu ảnh sẵn sàng, liên
  kết action item và có lịch sử mở/đóng.
- **TourCompletion**: Ghi nhận công tour hợp lệ của nhân viên, gắn booking, ảnh và nguồn KPI.
- **BookingReportDestination**: Cấu hình kênh chat nhận báo cáo theo tenant/cơ sở và loại báo cáo.
- **BookingReportRun**: Một lần tổng hợp/gửi báo cáo 20:08 hoặc 22:00 với scope, snapshot,
  checkpoint, attempt và kết quả.
- **ExportRequest**: Yêu cầu export có bộ lọc, scope, định dạng, trạng thái, progress, file media,
  checksum, expiry và requester.
- **BookingRetentionPolicyVersion**: Chính sách phiên bản cho ảnh khách/file export, gồm hiệu lực,
  giới hạn, actor và legal-hold rules.
- **MediaRetentionTombstone**: Bằng chứng binary đã xóa hoặc được giữ lại do legal hold mà không
  chứa nội dung media.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% booking được tạo trong kiểm thử concurrency tuân thủ khoảng cách 60 phút cho
  cùng nhân viên/cơ sở; không xuất hiện double-booking sau commit.
- **SC-002**: 100% truy cập cross-tenant và ngoài branch scope trong bộ test bị từ chối mà không
  lộ customer PII, booking, media, report hoặc export metadata.
- **SC-003**: Ít nhất 99% thao tác tạo/xem/cập nhật booking thông thường hoàn tất dưới 2 giây ở
  tải mục tiêu 200 request/giây, không tính thời gian upload binary và tạo export nền.
- **SC-004**: Hệ thống xử lý được 20.000 booking/ngày trên dữ liệu kiểm thử đại diện cho 100
  tenant và 500 cơ sở mà không sai tenant scope hoặc mất event.
- **SC-005**: Report 20:08 và 22:00 được tạo đúng business date/scope trong 5 phút từ lịch chạy;
  retry/rerun tự động không tạo thông báo trùng.
- **SC-006**: 100% booking `ARRIVED` thiếu ảnh tạo đúng một photo debt/action item; tải ảnh hợp lệ
  đóng debt idempotent và công tour không thể hoàn tất khi còn thiếu điều kiện.
- **SC-007**: 100% XLSX mẫu mở được bằng phần mềm bảng tính phổ biến, đối chiếu đúng số liệu nguồn
  và không thực thi dữ liệu người dùng như công thức.
- **SC-008**: 100% ảnh/file hết hạn trong kiểm thử retention được xóa hoặc giữ đúng legal hold,
  có tombstone/audit và không còn tải được sau khi xóa.
- **SC-009**: Mỗi FR/CR có ít nhất một verification được truy vết trong tasks; migration, unit,
  contract, integration, tenant isolation, RBAC, worker retry, retention và load gate đều pass
  trước khi đóng Module 4.

## Assumptions

- Module 1-3 đã đạt dependency gate; Module 4 tái sử dụng auth/JWT, tenant context, RBAC, audit,
  idempotency, dynamic forms, media, chat, outbox, action items, KPI source và penalty contracts
  hiện có thay vì tạo hệ thống song song.
- Chỉ nhân viên nội bộ tạo và quản lý booking trong MVP; Customer là hồ sơ nghiệp vụ, không phải
  tài khoản đăng nhập hay tenant membership.
- Quy tắc xung đột chỉ dựa trên giờ bắt đầu của booking cùng nhân viên/cơ sở; room, machine, bed,
  thời lượng dịch vụ và conflict của khách chưa thuộc MVP.
- `WALK_IN` là ngoại lệ nghiệp vụ duy nhất được bỏ qua khoảng cách 60 phút.
- Ảnh khách bắt buộc cho `ARRIVED`/công tour, nhưng `ARRIVED` có thể được ghi trước và tạo photo
  debt để vận hành không bị chặn tại quầy.
- Kênh báo cáo là chat nội bộ đã tồn tại trong Module 1; nếu thiếu hoặc mất hiệu lực, job fail an
  toàn và chờ cấu hình/rerun, không tự chọn một kênh khác.
- Giới hạn cụ thể cho range export, số dòng/file và retry/backoff sẽ được xác định trong plan dựa
  trên capacity target, miễn không thay đổi hành vi nghiệp vụ trong specification.
- Không cần credential AWS/FCM/APNs khi nghiệm thu local; object storage/chat notification dùng
  adapter hoặc test double nhưng giữ production-ready contract.
- Mobile UI và tích hợp trải nghiệm người dùng được thực hiện ở Module 5 sau khi Module 4 đạt
  dependency gate.
