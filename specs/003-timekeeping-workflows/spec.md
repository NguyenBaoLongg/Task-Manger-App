# Feature Specification: Chấm công và workflow duyệt

**Feature Branch**: `003-timekeeping-workflows`

**Created**: 2026-07-21

**Status**: Draft

**Input**: Tạo specification cho Module 3 dựa trên `docs/PRODUCT_REQUIREMENTS_MVP.md`,
constitution, Module 1/2 artifacts và reference của `$build-timekeeping-workflows`.
Chỉ đặc tả chấm công video, lịch ca, đi muộn, lịch nghỉ/nghỉ đột xuất, penalty và
approval workflow. Không implement cho tới khi spec/clarify/plan/tasks hoàn tất.

## Clarifications

### Session 2026-07-21

- Q: MVP xử lý phạt 50.000 VND cho video/check-in thế nào khi hệ thống chưa tự đánh giá chất lượng video? → A: Ca đã lên lịch mà không có video check-in sau mốc chốt theo policy là lỗi không thực hiện check-in 50.000 VND; video không đúng tiêu chuẩn chỉ bị phạt khi người có quyền review thủ công, không dùng AI tự chấm trong MVP. Nghỉ đột xuất không báo, nghỉ quá giới hạn và nghỉ sai quy định là các violation riêng.
- Q: Với đi muộn từ phút 16 đến dưới 90 phút, tiền phạt 2.000 VND/phút được tính theo tổng số phút muộn hay phần vượt quá 15 phút? → A: Tính 2.000 VND cho số phút vượt quá 15; 1-15 phút vẫn là nhóm phạt cố định 20.000 VND.
- Q: Module 3 MVP có quản lý quỹ phép/số dư ngày phép không? → A: Chưa quản lý quỹ phép trong MVP; chỉ quản lý lịch nghỉ, nghỉ đột xuất, nghỉ trùng, nghỉ liên tiếp, ngoại lệ và phạt.
- Q: Khi nào hệ thống chốt lỗi không thực hiện video check-in? → A: Đến 12:00 trưa theo múi giờ tenant, nếu ngày đó có ca làm và không phải OFF/nghỉ hợp lệ mà chưa có video check-in thì hệ thống tạo lỗi không thực hiện check-in 50.000 VND theo policy. Nếu nhân viên check-in hoặc được quản lý xác nhận bổ sung sau 12:00, dữ liệu đó chỉ dùng để xác định có đi làm và tính đi muộn, không tự xóa lỗi không check-in trước 12:00. Check-in sau 15:00 vẫn coi là đi muộn và vẫn phải nộp báo cáo KPI; không có check-in hoặc correction được duyệt sau mốc 12:00 thì ngày đó coi như không đi làm cho nghĩa vụ báo cáo KPI nhưng vẫn được đánh giá theo policy vắng mặt/check-in.
- Q: Ngưỡng nghỉ quá 5 ngày/tháng được tính thế nào? → A: Tính tổng lịch nghỉ/nghỉ đột xuất đã duyệt trong tháng; nghỉ buổi sáng tính 0,5 ngày, không tính lịch OFF/ngày lễ Tết do quản lý set. Khi vượt 5 ngày, hệ thống nhắc quản lý và đánh dấu nhân viên nghỉ quá hạn trong tháng.
- Q: Bot nhắc check-in trước ca hoạt động thế nào? → A: Trước giờ bắt đầu mỗi ca 15 phút theo múi giờ tenant, worker tìm nhân viên có lịch ca đó nhưng chưa check-in, không OFF/nghỉ hợp lệ, rồi phát một thông báo tenant/branch-scoped tag tên những người còn thiếu check-in. Reminder phải có dedupe key theo tenant, cơ sở, ngày, ca và lead time để retry không gửi trùng.
- Q: Bot có cảnh báo lần cuối trước mốc phạt thiếu check-in không? → A: Có. Khoảng một tiếng trước mốc 12:00, mặc định 11:00 theo múi giờ tenant, worker gửi cảnh báo check-in lần cuối cho nhân viên có lịch làm trong ngày nhưng vẫn chưa check-in video. Nếu đến 12:00 vẫn không có check-in và không phải OFF/nghỉ hợp lệ thì mặc định ngày đó bị xem là không làm, đồng thời tạo lỗi không check-in/phạt theo policy; correction hoặc check-in rất muộn chỉ có thể chứng minh có làm nếu được quy trình hợp lệ chấp nhận và không tự xóa lỗi trước 12:00.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Đăng ký và giữ lịch ca đúng lịch sử (Priority: P1)

Nhân viên đăng ký ca 08:30 hoặc 09:30 từ đầu tuần hoặc trước nhiều tuần, tự sửa khi ca còn
cách trên 24 giờ và gửi yêu cầu đổi ca khi đã vào vùng cần duyệt. Quản lý có thể điều chỉnh
lịch sau khi ca bắt đầu nếu có permission và lý do rõ ràng.

**Why this priority**: Lịch ca là nguồn gốc để tính check-in, đi muộn, nghỉ và KPI tỷ lệ đúng giờ.
Nếu lịch không có phiên bản và snapshot tại thời điểm chấm công thì mọi khoản phạt lịch sử có thể
bị sai khi lịch bị sửa sau đó.

**Independent Test**: Tạo lịch cho một nhân viên ở cơ sở đang hiệu lực, sửa trước mốc 24 giờ, gửi
yêu cầu đổi ca trong vòng 24 giờ và chứng minh check-in sau đó tham chiếu đúng phiên bản lịch đã
áp dụng tại thời điểm nghiệp vụ.

**Acceptance Scenarios**:

1. **Given** nhân viên có một cơ sở làm việc hiện hành và ca tương lai còn cách trên 24 giờ,
   **When** nhân viên đổi từ ca 08:30 sang 09:30, **Then** lịch mới có hiệu lực, lịch cũ được giữ
   trong lịch sử và thay đổi có actor/thời điểm.
2. **Given** ca bắt đầu trong vòng 24 giờ, **When** nhân viên muốn đổi ca, **Then** hệ thống tạo
   yêu cầu duyệt, lịch cũ tiếp tục có hiệu lực cho đến khi yêu cầu được phê duyệt.
3. **Given** ca đã bắt đầu, **When** quản lý có permission tạo điều chỉnh với lý do, **Then** hệ
   thống tạo phiên bản/audit mới, không ghi đè bản ghi lịch hoặc bản ghi chấm công ban đầu.
4. **Given** hai quyết định duyệt đổi ca đến đồng thời, **When** cả hai được xử lý, **Then** chỉ
   một kết quả hợp lệ được chấp nhận và lịch không rơi vào trạng thái mâu thuẫn.

---

### User Story 2 - Check-in video và tính đi muộn có thể giải thích (Priority: P1)

Nhân viên xác nhận chính sách video đang hiệu lực, check-in bằng video quay rõ người và khu vực
làm việc, sau đó hệ thống ghi timestamp server, phiên bản lịch áp dụng, kết quả duyệt video và số
phút đi muộn chính xác theo múi giờ tenant.

**Why this priority**: Đây là luồng hằng ngày, tạo dữ liệu có thẩm quyền cho ngày công, tiền phạt
đi muộn/video và KPI tỷ lệ đúng giờ của Module 2.

**Independent Test**: Một nhân viên check-in ở các mốc 08:30:59, 08:45:59 và 08:46:00; hệ thống
trả lần lượt 0, 15 và 16 phút muộn, lưu đủ bằng chứng tính toán và không tạo late occurrence khi
kết quả là 0.

**Acceptance Scenarios**:

1. **Given** nhân viên chưa xác nhận phiên bản chính sách video hiện hành, **When** mở bước quay
   hoặc tải video check-in, **Then** hệ thống yêu cầu xác nhận chính sách trước và chưa nhận video.
2. **Given** nhân viên đã xác nhận chính sách và có lịch áp dụng, **When** check-in bằng video hợp
   lệ, **Then** hệ thống lưu video, timestamp server, cơ sở hiện hành, lịch snapshot và trạng thái
   chờ/đã duyệt video.
3. **Given** check-in sau giờ bắt đầu ca, **When** hệ thống tính đi muộn, **Then** số phút được làm
   tròn xuống theo giây đã qua và lưu cả chênh lệch giây lẫn phút đã tính.
4. **Given** ca đã lên lịch không có video check-in đến 12:00 trưa theo múi giờ tenant, **When** hệ
   thống đánh giá attendance, **Then** hệ thống tạo lỗi không thực hiện check-in 50.000 VND theo
   policy nếu ngày đó không phải OFF hoặc nghỉ hợp lệ; check-in/correction sau mốc này không tự xóa lỗi.
5. **Given** video có thể không đạt tiêu chuẩn hình ảnh, **When** người có quyền review thủ công,
   **Then** hệ thống chỉ tạo violation nếu reviewer kết luận không đạt; MVP không dùng AI để tự kết
   luận tác phong, đồng phục, trang điểm, đầu tóc, giày dép hoặc bối cảnh.
6. **Given** nhân viên check-in sau 15:00 trong ngày làm việc, **When** hệ thống đánh giá attendance,
   **Then** ngày đó vẫn được coi là có đi làm, bị tính đi muộn theo policy và vẫn thuộc diện phải nộp
   báo cáo KPI hằng ngày.
7. **Given** ca 08:30 còn 15 phút nữa bắt đầu và có nhân viên trong ca chưa check-in, **When** worker reminder
   chạy, **Then** bot phát một thông báo tenant/branch-scoped tag tên các nhân viên chưa check-in, bỏ qua người
   đã check-in hoặc đã OFF/nghỉ hợp lệ và retry không tạo thông báo trùng.
8. **Given** đã đến 11:00 theo múi giờ tenant và vẫn có nhân viên có lịch làm buổi sáng chưa check-in, **When**
   worker reminder chạy, **Then** bot phát cảnh báo check-in lần cuối trước 12:00, tag đúng nhân viên còn thiếu,
   bỏ qua người đã check-in hoặc đã OFF/nghỉ hợp lệ; nếu đến 12:00 vẫn không có check-in thì ngày đó mặc định
   không làm và bị cộng phạt không check-in theo policy.

---

### User Story 3 - Duyệt đơn đi muộn, đổi ca và nghỉ theo cấu hình tenant (Priority: P1)

Tenant Owner cấu hình workflow duyệt giới hạn cho các đơn Module 3: đổi ca, xin đi muộn, lịch nghỉ
và nghỉ đột xuất. Nhân viên gửi đơn, hệ thống chọn người duyệt theo cấu hình một cấp, nhiều cấp
tuần tự hoặc song song, gửi thông báo và chốt kết quả idempotently.

**Why this priority**: PRD yêu cầu luồng duyệt cần thiết cho đổi ca, đi muộn và nghỉ; các quyết
định này ảnh hưởng trực tiếp đến lịch vận hành và tiền phạt.

**Independent Test**: Cấu hình ba workflow cho cùng tenant gồm một cấp, hai cấp tuần tự và song
song; gửi các loại đơn tương ứng rồi chứng minh người duyệt đúng phạm vi nhận thông báo, quyết
định đồng thời không tạo kết quả trùng và hiệu ứng cuối chỉ xảy ra một lần.

**Acceptance Scenarios**:

1. **Given** nhân viên gửi đơn xin đi muộn trước giờ vào ca ít nhất 30 phút, **When** đơn được quản
   lý phê duyệt sau giờ vào ca, **Then** hệ thống tạo điều chỉnh giảm 50% tiền phạt cơ bản có audit
   thay vì sửa mất khoản tạm tính ban đầu.
2. **Given** workflow nhiều cấp tuần tự, **When** cấp đầu phê duyệt, **Then** cấp tiếp theo mới trở
   thành người cần quyết định và nhận thông báo.
3. **Given** workflow song song yêu cầu đủ số quyết định đã cấu hình, **When** một người duyệt từ
   chối hoặc đủ người duyệt đồng ý, **Then** hệ thống chốt trạng thái cuối theo rule đã công bố.
4. **Given** approver thuộc tenant khác hoặc ngoài branch scope, **When** được đưa vào cấu hình
   hoặc quyết định đơn, **Then** thao tác bị từ chối an toàn và không tạo hiệu ứng nghiệp vụ.

---

### User Story 4 - Quản lý lịch nghỉ, nghỉ đột xuất và xung đột lịch nghỉ (Priority: P2)

Nhân viên gửi lịch nghỉ hoặc đơn nghỉ đột xuất, chọn nghỉ cả ngày, nghỉ buổi sáng hoặc một khoảng
nhiều ngày. Hệ thống kiểm tra thông báo, trùng lịch theo cơ sở và bộ phận/vị trí, quy tắc không nghỉ
liên tiếp hai ngày và ngoại lệ có minh chứng. Khi đơn được duyệt, lịch làm được đổi thành nghỉ đúng
một lần. Quản lý có thể set ngày `OFF`/ngày lễ Tết của công ty để nhân viên không bị yêu cầu
check-in, báo cáo hoặc bị phạt vào ngày nghỉ chung. MVP chưa quản lý quỹ phép/số dư ngày phép.

**Why this priority**: Nghỉ hợp lệ ảnh hưởng đến lịch, KPI, phạt và vận hành nhân sự; kiểm tra xung
đột phải do hệ thống có thẩm quyền thực hiện để mobile không tự kết luận sai.

**Independent Test**: Hai nhân viên cùng cơ sở và cùng vị trí gửi đơn nghỉ trùng ngày; hệ thống từ
chối đơn gây xung đột khi gửi và khi duyệt trong transaction, nhưng cho phép nhân viên ở cơ sở khác
nghỉ cùng ngày.

**Acceptance Scenarios**:

1. **Given** nhân viên gửi đơn nghỉ trùng với người cùng cơ sở và cùng bộ phận/vị trí, **When** hệ
   thống kiểm tra đơn, **Then** đơn không được phê duyệt và trả về cơ sở, bộ phận/vị trí cùng đơn
   gây xung đột.
2. **Given** nhân viên nghỉ hai ngày liên tiếp, **When** không có ngoại lệ hợp lệ, **Then** hệ thống
   chặn hoặc đánh dấu vi phạm theo policy và không tự bỏ qua ngày nối tuần.
3. **Given** nhân viên có minh chứng đi bệnh viện, đi đám cưới hoặc ngoại lệ được duyệt trước,
   **When** đơn được phê duyệt, **Then** hệ thống cho phép ngoại lệ, lưu minh chứng và cập nhật lịch
   thành nghỉ trong cùng giao dịch chốt duyệt.
4. **Given** cùng quyết định phê duyệt được retry, **When** xử lý lại, **Then** lịch không tạo bản
   nghỉ trùng và không phát sinh hiệu ứng phạt/thông báo lặp.
5. **Given** nhân viên xin nghỉ nhiều ngày bằng khoảng ngày bắt đầu/kết thúc, **When** quản lý duyệt,
   **Then** hệ thống áp dụng kết quả cho từng ngày thuộc khoảng nghỉ và giữ một lịch sử quyết định.
6. **Given** tổng lịch nghỉ/nghỉ đột xuất đã duyệt của một nhân viên trong tháng vượt 5 ngày,
   **When** hệ thống tổng hợp tháng, **Then** quản lý nhận nhắc nhở và nhân viên được đánh dấu nghỉ
   quá hạn trong tháng.

---

### User Story 5 - Sổ phạt và nguồn chấm công cho vận hành sau này (Priority: P2)

Nhân viên và quản lý xem được các khoản phạt phát sinh từ video, đi muộn, không báo, nghỉ sai quy
định và điều chỉnh. Nhân viên gửi thông tin nộp tiền; người có quyền xác nhận/từ chối/miễn/hoàn
tiền. Hệ thống đồng thời xuất dữ liệu chấm công có thẩm quyền cho KPI tỷ lệ đúng giờ và các module
sau.

**Why this priority**: Tiền phạt cần minh bạch, không phụ thuộc payroll/cổng thanh toán và phải tái
hiện được nguồn phát sinh. Module 2 đang chờ nguồn attendance chính thức cho KPI đúng giờ.

**Independent Test**: Một nhân viên có video không đạt, đi muộn 16 phút và không báo trước trong
cùng ngày; hệ thống lưu hai violation, settlement chọn khoản cao hơn giữa video và late, cộng lỗi
không báo, rồi tổng hợp vào sổ phạt tháng đúng cơ sở.

**Acceptance Scenarios**:

1. **Given** nhân viên có video không đạt và đi muộn cùng ngày, **When** hệ thống settlement tiền
   phạt, **Then** chỉ khoản cao hơn giữa video và late base được tính, khoản bị bỏ qua được lưu với
   lý do và lỗi không báo được cộng độc lập nếu có.
2. **Given** nhân viên gửi chứng từ nộp tiền chuyển khoản, **When** quản lý/kế toán xác nhận, từ
   chối, miễn hoặc hoàn tiền, **Then** trạng thái đổi theo luồng chuẩn, có lý do và không làm mất
   lịch sử số tiền trước/sau.
3. **Given** Module 2 cần tỷ lệ đúng giờ, **When** dữ liệu chấm công của ngày đã được xác nhận,
   **Then** nguồn attendance trả kết quả có thẩm quyền, đúng tenant/cơ sở/nhân viên/ngày và không
   đưa video hay URL ký vào dữ liệu KPI.

### Edge Cases

- Nhân viên không có cơ sở hiện hành hoặc có nhiều cơ sở cùng hiệu lực tại thời điểm lịch/check-in:
  hệ thống phải dừng an toàn, tạo cảnh báo chất lượng dữ liệu và không tự chọn cơ sở để phạt.
- Ca 08:30 hoặc 09:30 được tính theo múi giờ tenant; ngày nghiệp vụ, timestamp gốc và instant server
  phải đủ để audit khi lịch/policy thay đổi.
- Check-in lúc 08:30:59 không tạo late occurrence, không dùng lượt miễn đầu tháng, không phạt và
  không đánh dấu ảnh hưởng hàng đợi nhận khách.
- Đơn xin đi muộn báo sau hạn 30 phút, chưa duyệt hoặc bị từ chối không được tự giảm 50% tiền phạt.
- Lần đi muộn đầu tiên trong tháng được miễn phạt cơ bản nhưng vẫn bị cộng 100.000 VND nếu không
  báo đúng hạn.
- Policy phạt thay đổi giữa tháng không được sửa ngược khoản phạt đã chốt; sửa sai phải bằng
  adjustment có lý do.
- Ca đã được đổi thành `OFF` hoặc nghỉ hợp lệ trước mốc 12:00 trưa theo múi giờ tenant không được xem là thiếu check-in và
  không thuộc diện phải nộp báo cáo KPI ngày đó.
- Ngày `OFF`/ngày lễ Tết do quản lý set không được tính là ngày nghỉ cá nhân, không tiêu thụ ngưỡng
  nghỉ quá 5 ngày/tháng và không tạo phạt thiếu check-in, đi muộn hoặc thiếu báo cáo.
- Không có check-in trước 12:00 trưa theo múi giờ tenant tạo lỗi không thực hiện check-in trong ngày; nếu
  sau mốc này vẫn không có check-in hoặc correction được quản lý duyệt thì hệ thống không yêu cầu báo cáo KPI
  ngày đó nhưng vẫn xử lý các violation vắng mặt/check-in theo policy.
- Video upload hoàn tất nhưng conversion thất bại hoặc provider media tạm lỗi: bản ghi nghiệp vụ
  không được chuyển sang trạng thái đã sẵn sàng giả và job phải retry an toàn.
- Hai approver quyết định gần đồng thời trong workflow song song hoặc tuần tự không được làm đơn có
  hai trạng thái cuối.
- Nghỉ đột xuất lần thứ hai trong tháng và không thông báo phải tạo hai lỗi độc lập, không gộp mất
  một lỗi.
- Nhân viên thuộc nhiều bộ phận/vị trí phải kiểm tra xung đột nghỉ trên mọi phân công có hiệu lực
  tại cơ sở và ngày nghỉ.
- Membership bị suspend/rời tenant sau khi tạo lịch, check-in hoặc penalty không được xóa hoặc sửa
  mất lịch sử.
- Retention xóa video sau thời hạn phải giữ tombstone metadata cần thiết và tôn trọng legal hold.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST quản lý ca làm tenant-scoped với tối thiểu hai ca seed 08:30 và 09:30
  theo múi giờ tenant mẫu; tenant có thể version cấu hình ca mà không sửa lịch sử đã phát sinh.
- **FR-002**: Nhân viên MUST có thể đăng ký ca lần đầu cho chính mình vào bất kỳ thời điểm nào trước
  khi ca bắt đầu, kể cả trước nhiều tuần, nếu có đúng một cơ sở hiện hành.
- **FR-003**: Nhân viên MUST được tự sửa ca khi thời điểm bắt đầu ca còn cách trên 24 giờ; mọi thay
  đổi MUST giữ lịch sử ca cũ/ca mới, actor, thời điểm và lý do khi có.
- **FR-004**: Trong vòng 24 giờ trước ca, nhân viên MUST gửi yêu cầu đổi ca thay vì sửa trực tiếp;
  lịch cũ tiếp tục có hiệu lực cho đến khi yêu cầu được duyệt.
- **FR-005**: Sau khi ca bắt đầu, chỉ người có permission quản lý phù hợp MUST được tạo điều chỉnh
  lịch với lý do bắt buộc; điều chỉnh MUST tạo phiên bản/audit mới và không ghi đè chấm công cũ.
- **FR-006**: Bản ghi chấm công MUST snapshot phiên bản lịch áp dụng, cơ sở hiện hành, timestamp
  server và ngày nghiệp vụ để phép tính lịch sử không đổi khi lịch bị sửa sau đó.
- **FR-007**: Trước lần check-in video đầu tiên trong tenant hoặc khi policy video có thay đổi quan
  trọng, nhân viên MUST chủ động xác nhận phiên bản chính sách hiện hành; chưa xác nhận thì hệ thống
  không nhận video check-in.
- **FR-008**: Bằng chứng xác nhận policy video MUST lưu tenant, membership, policy version, thời
  điểm server, phiên/thiết bị ở mức phù hợp và hành động xác nhận.
- **FR-009**: Check-in tiêu chuẩn MUST yêu cầu video quay rõ người và khu vực làm việc thực tế, liên
  kết media đã được quyền truy cập và không lưu binary trong dữ liệu giao dịch.
- **FR-010**: Video check-in MUST có vòng đời upload, xác minh, conversion sang bản phát phù hợp,
  trạng thái sẵn sàng/thất bại và retry-safe worker; conversion không được chặn thao tác gửi request
  của người dùng.
- **FR-011**: Người có quyền MUST ghi nhận hoặc duyệt kết quả video đạt/không đạt tiêu chuẩn; MVP
  MUST không dùng AI để tự kết luận trang điểm, đồng phục, đầu tóc, giày dép, độ sạch hoặc bối cảnh.
- **FR-012**: Với ca đã lên lịch và chưa được đổi thành `OFF` hoặc nghỉ hợp lệ, không có video
  check-in trước 12:00 trưa theo múi giờ tenant MUST tạo violation không thực hiện check-in 50.000 VND
  theo policy version đang hiệu lực; check-in hoặc correction được duyệt sau mốc này không tự xóa violation.
- **FR-013**: Check-in video không đạt tiêu chuẩn hình ảnh/bối cảnh MUST chỉ tạo violation 50.000 VND
  khi người có quyền review thủ công kết luận không đạt; hệ thống không tự động chấm chất lượng video
  trong MVP.
- **FR-014**: Late minutes MUST được tính từ timestamp check-in server so với giờ bắt đầu của lịch
  snapshot, theo công thức làm tròn xuống số phút tròn đã qua và theo múi giờ tenant.
- **FR-015**: Khi `late_minutes = 0`, hệ thống MUST không tạo late occurrence, không dùng lượt miễn
  đi muộn đầu tháng, không phát sinh phạt và không đánh dấu ảnh hưởng hàng đợi nhận khách.
- **FR-016**: Check-in sau 15:00 theo múi giờ tenant MUST vẫn được coi là có đi làm trong ngày, bị
  tính đi muộn theo policy và vẫn thuộc diện phải nộp báo cáo KPI hằng ngày.
- **FR-017**: Không có check-in hoặc correction được duyệt sau mốc 12:00 trưa theo múi giờ tenant MUST làm
  ngày đó không thuộc diện phải nộp báo cáo KPI vì được coi là không đi làm; trạng thái này không miễn các
  violation vắng mặt, không check-in hoặc nghỉ sai quy định nếu policy áp dụng.
- **FR-018**: Mỗi nhân viên MUST được miễn tiền phạt cơ bản theo số phút cho lần đi muộn đầu tiên
  trong tháng; việc miễn này không miễn nghĩa vụ báo trước.
- **FR-019**: Từ lần đi muộn thứ hai trong tháng, policy mặc định MUST áp dụng 1-15 phút: 20.000 VND,
  16-89 phút: 2.000 VND nhân số phút vượt quá 15, và từ 90 phút trở lên: 200.000 VND; các mức này
  MUST là policy versioned theo tenant.
- **FR-020**: Đơn xin đi muộn chỉ được giảm 50% tiền phạt cơ bản khi được gửi trước giờ vào ca ít
  nhất 30 phút trong kênh/luồng ghi nhận chung phù hợp và được quản lý phê duyệt.
- **FR-021**: Nếu đơn xin đi muộn được phê duyệt sau khi phạt tạm tính đã phát sinh, hệ thống MUST
  tạo adjustment có audit để giảm 50%, không sửa mất lịch sử khoản ban đầu.
- **FR-022**: Không báo đúng hạn MUST giữ 100% tiền phạt cơ bản nếu có và cộng thêm 100.000 VND lỗi
  không báo; lỗi này áp dụng cả cho lần đi muộn đầu tiên trong tháng.
- **FR-023**: Nhân viên đi muộn MUST được đánh dấu ảnh hưởng hàng đợi nhận khách mới hoặc khách vãng
  lai trong ngày tại cơ sở liên quan; Module 3 chỉ tạo tín hiệu có thẩm quyền, không triển khai booking.
- **FR-024**: Nếu cùng ngày có video không đạt và đi muộn, settlement MUST lưu hai violation riêng
  nhưng chỉ tính khoản cao hơn giữa video penalty và final late base penalty; lỗi không báo được cộng
  độc lập sau đó.
- **FR-025**: Penalty policy cho video, đi muộn, không báo, nghỉ đột xuất, nghỉ sai quy định và
  settlement MUST có phiên bản, phạm vi tenant/cơ sở khi cần, hiệu lực, actor, reason và không sửa
  ngược kết quả đã chốt.
- **FR-026**: Sổ phạt nội bộ MUST lưu nguồn phát sinh, policy version, số tiền gốc, điều chỉnh, số
  còn phải nộp, kỳ tổng hợp tháng và cơ sở/membership liên quan.
- **FR-027**: Trạng thái nộp phạt MUST hỗ trợ `PENDING`, `SUBMITTED`, `CONFIRMED`, `REJECTED`,
  `WAIVED` và `REFUNDED`; nhân viên chỉ gửi thông tin/chứng từ, người có permission mới xác nhận,
  từ chối, miễn hoặc hoàn tiền với lý do.
- **FR-028**: Cuối tháng hệ thống MUST tổng hợp phạt theo tenant, cơ sở, nhân viên, loại lỗi, trạng
  thái nộp và tổng tiền đã xác nhận vào quỹ nội bộ, không tự động trừ lương và không phụ thuộc cổng
  thanh toán.
- **FR-029**: Tenant Owner MUST có thể cấu hình workflow duyệt giới hạn cho các request Module 3:
  đổi ca, xin đi muộn, lịch nghỉ và nghỉ đột xuất; không triển khai workflow builder tổng quát trong MVP.
- **FR-030**: Workflow duyệt MUST hỗ trợ một cấp, nhiều cấp tuần tự và nhiều người duyệt song song
  với rule hoàn tất rõ ràng, phiên bản cấu hình và phạm vi approver theo tenant/cơ sở.
- **FR-031**: Mọi request duyệt MUST có trạng thái, người yêu cầu, loại đơn, dữ liệu nguồn, cơ sở,
  lịch/ngày liên quan, workflow version, quyết định từng bước, lý do và audit.
- **FR-032**: Quyết định duyệt/reject/cancel MUST idempotent, an toàn khi retry hoặc khi nhiều approver
  quyết định đồng thời, và chỉ tạo hiệu ứng cuối đúng một lần.
- **FR-033**: Khi request được chốt, hệ thống MUST gửi thông báo retry-safe cho người yêu cầu và
  approver liên quan theo phạm vi tenant/cơ sở, không phát thông báo sang tenant khác.
- **FR-034**: Khi đơn nghỉ được duyệt, hệ thống MUST cập nhật lịch thành `OFF` hoặc trạng thái nghỉ
  tương đương trong cùng transaction chốt duyệt và không làm mất lịch sử lịch ban đầu.
- **FR-035**: Nhân viên MUST có thể tạo request nghỉ theo cả ngày, buổi sáng hoặc khoảng nhiều ngày
  với ngày bắt đầu/ngày kết thúc; request MUST được gửi đến quản lý có thẩm quyền và chờ duyệt trước
  khi lịch được đổi.
- **FR-036**: MVP MUST không quản lý quỹ phép hoặc số dư ngày phép; khi đơn nghỉ hợp lệ được duyệt,
  hệ thống chỉ cập nhật lịch nghỉ, trạng thái request, action item, notification và các violation/phạt liên quan.
- **FR-037**: Nghỉ đột xuất MUST lưu bằng chứng đã thông báo rõ trong nhóm/kênh chung; tự ý nghỉ không
  thông báo tạo violation 50.000 VND/lần.
- **FR-038**: Mỗi tháng chỉ có tối đa một ngày nghỉ đột xuất không bị lỗi vượt giới hạn; từ ngày thứ
  hai MUST tạo violation 100.000 VND/lần, độc lập với lỗi không thông báo.
- **FR-039**: Nghỉ sai quy định hoặc tự ý nghỉ MUST tạo violation 200.000 VND/lần theo policy version,
  trừ khi có ngoại lệ được duyệt hợp lệ.
- **FR-040**: Hệ thống MUST chặn nghỉ trùng giữa nhân viên cùng cơ sở và cùng bộ phận/vị trí trong
  khoảng nghỉ chồng lấn; nhân viên ở cơ sở khác được phép nghỉ cùng ngày.
- **FR-041**: Nếu nhân viên thuộc nhiều bộ phận/vị trí, kiểm tra xung đột nghỉ MUST xét mọi phân công
  có hiệu lực tại cơ sở và ngày nghỉ; chỉ cần trùng một bộ phận/vị trí là đơn xung đột.
- **FR-042**: Hệ thống MUST chặn nghỉ liên tiếp hai ngày, kể cả nối từ tuần trước sang tuần sau, trừ
  ngoại lệ đi bệnh viện, đi đám cưới hoặc trường hợp đặc biệt được người có thẩm quyền duyệt trước.
- **FR-043**: Minh chứng nghỉ ngoại lệ, chứng từ nộp phạt và video check-in MUST dùng nền media có
  permission, retention, tombstone và legal hold phù hợp với policy sản phẩm.
- **FR-044**: Module 3 MUST cung cấp nguồn chấm công có thẩm quyền cho KPI tỷ lệ đúng giờ: dữ liệu
  được lọc theo tenant, membership, cơ sở và ngày nghiệp vụ, trả `null` khi chưa có nguồn và không
  coi thiếu dữ liệu là 0.
- **FR-045**: Source chấm công cho KPI MUST chỉ dùng attendance đã được hệ thống xác nhận, không nhận
  actual từ client và không ghi video, URL ký hoặc metadata nhạy cảm vào log/outbox.
- **FR-046**: Module 3 MUST tạo/đóng action item cho video check-in thiếu, request cần bổ sung, quyết
  định cần duyệt, phạt cần nộp và nghỉ/đổi ca bị chặn theo source key duy nhất, retry không tạo trùng.
- **FR-047**: Seed Module 3 MUST bổ sung idempotently ca 08:30/09:30, policy video/late/leave mặc
  định và cấu hình workflow mẫu cho tenant “Công ty TNHH ABC” mà không làm thay đổi dữ liệu Module 1/2.
- **FR-048**: Người có permission quản lý lịch MUST có thể set ngày `OFF`/ngày lễ Tết theo tenant
  hoặc cơ sở để miễn yêu cầu check-in, báo cáo KPI và phạt attendance cho ngày nghỉ chung; các ngày
  này không tính vào tổng ngày nghỉ cá nhân.
- **FR-049**: Hệ thống MUST tính tổng lịch nghỉ/nghỉ đột xuất đã duyệt của mỗi nhân viên trong tháng,
  trong đó nghỉ buổi sáng tính 0,5 ngày và khoảng nhiều ngày tính theo từng ngày áp dụng; khi tổng
  vượt 5 ngày, hệ thống MUST nhắc quản lý và đánh dấu nhân viên nghỉ quá hạn trong tháng.
- **FR-050**: Trước mỗi ca 15 phút theo múi giờ tenant, worker MUST phát reminder check-in cho ca đó,
  tag tên các membership có lịch ca nhưng chưa check-in, không `OFF`/nghỉ hợp lệ, theo phạm vi tenant/cơ sở;
  reminder MUST idempotent theo tenant, cơ sở, ngày nghiệp vụ, ca và lead time để retry không gửi trùng.
- **FR-051**: Trước mốc 12:00 khoảng một tiếng, mặc định 11:00 theo múi giờ tenant, worker MUST phát cảnh báo
  check-in lần cuối cho các membership có lịch làm trong ngày nhưng chưa check-in video, không `OFF`/nghỉ hợp lệ,
  theo phạm vi tenant/cơ sở/ca; reminder MUST idempotent theo tenant, cơ sở, ngày nghiệp vụ, ca, mốc cutoff và
  lead time. Sau 12:00, nếu vẫn không có check-in/correction hợp lệ thì ngày đó MUST được mặc định là không làm
  và violation/phạt không check-in MUST được tạo theo policy.

### Constitutional & Cross-Cutting Requirements *(mandatory)*

- **CR-001**: Mọi lịch, check-in, video, request, workflow, violation, penalty,
  adjustment, action item, outbox và job cursor của Module 3 MUST tenant-scoped; test phải chứng minh
  từ chối ID của tenant khác ở mọi luồng đọc/ghi.
- **CR-002**: Permission và scope MUST được định nghĩa cho đăng ký/sửa lịch, điều chỉnh sau giờ bắt
  đầu, duyệt video, cấu hình policy/workflow, quyết định đơn, xem tổng hợp, xác nhận nộp phạt và legal hold.
- **CR-003**: Schedule version, policy version, workflow version, request decision, attendance
  calculation, violation, penalty settlement, adjustment và payment transition MUST có audit, reason
  khi bắt buộc, idempotency và transaction/concurrency boundary rõ.
- **CR-004**: Video nhân viên, minh chứng nghỉ và chứng từ nộp phạt MUST được tối thiểu hóa, truy cập
  bằng quyền hiện hành, không lộ signed URL/token trong log/audit và tuân retention 180 ngày cho video,
  365 ngày cho ảnh minh chứng nhân viên và 5 năm cho metadata/audit.
- **CR-005**: Module MUST phục vụ mục tiêu 100 tenant, 500 cơ sở, 10.000 tài khoản, 10.000 video
  check-in/ngày, 200 yêu cầu/giây và worker retry-safe mà không hard-code các con số này thành giới hạn
  nghiệp vụ.
- **CR-006**: Mỗi FR/CR MUST được ánh xạ ở plan/tasks tới unit, contract, integration, tenant-isolation,
  migration, worker retry/concurrency, media-failure, load hoặc end-to-end verification; local test không
  cần AWS/FCM/APNs thật.

### Key Entities *(include if feature involves data)*

- **Shift Definition**: Ca làm tenant-scoped, giờ bắt đầu, múi giờ, trạng thái và phiên bản hiệu lực.
- **Work Schedule Version**: Lịch làm của membership theo ngày/ca/cơ sở, lịch sử tạo/sửa/điều chỉnh.
- **Attendance Event**: Check-in/check-out hoặc sự kiện vắng mặt có timestamp server, ngày nghiệp vụ
  và schedule snapshot.
- **Video Policy Acknowledgement**: Bằng chứng nhân viên đã xác nhận phiên bản chính sách video.
- **Check-in Video Asset**: Media video gắn với attendance, trạng thái upload/conversion/retention.
- **Video Review Result**: Kết quả người có quyền đánh giá video đạt/không đạt và lý do.
- **Missing Check-in Violation**: Lỗi không thực hiện video check-in cho ca đã lên lịch sau mốc chốt
  policy, tách khỏi lỗi nghỉ đột xuất không báo và nghỉ sai quy định.
- **Late Occurrence**: Bản ghi đi muộn gồm chênh lệch giây, late minutes, lần trong tháng và tác động.
- **Penalty Policy Version**: Cấu hình phạt video/late/no-notice/leave có hiệu lực theo tenant/cơ sở.
- **Violation**: Lỗi nghiệp vụ riêng lẻ như video không đạt, đi muộn, không báo, nghỉ sai quy định.
- **Penalty Settlement / Adjustment**: Kết quả tính tiền phạt từ violation và các giao dịch điều chỉnh.
- **Penalty Payment Record**: Thông tin nộp tiền, chứng từ, trạng thái và lịch sử xác nhận/hoàn/miễn.
- **Request Type / Workflow Definition Version**: Loại đơn Module 3 và cấu hình duyệt một cấp/tuần tự/song song.
- **Approval Run / Step / Decision**: Phiên duyệt của một request, từng bước, người duyệt và quyết định.
- **Late Notice Request**: Đơn xin đi muộn và bằng chứng báo trước đủ/không đủ hạn.
- **Leave Request**: Đơn lịch nghỉ/nghỉ đột xuất, ngày nghỉ, minh chứng, ngoại lệ và trạng thái.
- **Company Off Calendar**: Ngày `OFF`, lễ Tết hoặc nghỉ chung do quản lý set theo tenant/cơ sở.
- **Monthly Absence Summary**: Tổng lịch nghỉ/nghỉ đột xuất đã duyệt trong tháng, gồm trạng thái vượt
  ngưỡng 5 ngày và lần nhắc quản lý.
- **Leave Conflict Snapshot**: Bằng chứng xung đột nghỉ theo cơ sở, bộ phận/vị trí và phân công hiệu lực.
- **Action Item**: Việc cần hoàn thành phát sinh từ check-in, request, phạt hoặc quyết định cần duyệt.
- **Check-in Reminder Event**: Sự kiện nhắc trước ca gồm tenant, cơ sở, ngày nghiệp vụ, ca, danh sách membership
  được tag, loại reminder trước ca hoặc cảnh báo cuối trước 12:00, nội dung bot đã redacted và dedupe key chống gửi trùng.
- **Attendance KPI Source Snapshot**: Nguồn có thẩm quyền cho KPI tỷ lệ đúng giờ của Module 2.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% check-in trong test boundary 08:30:59, 08:45:59 và 08:46:00 tạo late minutes đúng
  0, 15 và 16, đồng thời lưu đủ timestamp gốc, schedule snapshot và số giây chênh lệch.
- **SC-002**: 100% thao tác cross-tenant/cross-branch trong lịch, check-in, video, workflow, nghỉ và
  sổ phạt bị từ chối mà không rò dữ liệu hoặc metadata tồn tại.
- **SC-003**: 100 lần retry/concurrent decision cho cùng request chỉ tạo một trạng thái cuối, một hiệu
  ứng lịch nghỉ hoặc đổi ca và một bộ thông báo/outbox hợp lệ.
- **SC-004**: 100% policy/workflow/schedule thay đổi sau khi kết quả đã chốt không làm đổi số tiền,
  late minutes, trạng thái nghỉ hoặc quyết định lịch sử đã snapshot.
- **SC-005**: Với cùng ngày có video không đạt và đi muộn, 100% settlement chọn đúng khoản cao hơn,
  cộng lỗi không báo độc lập và hiển thị được thành phần bị suppress cùng lý do.
- **SC-006**: 100% test phạt đi muộn tháng thứ hai trở đi áp dụng đúng nhóm 1-15 phút cố định
  20.000 VND, nhóm 16-89 phút tính 2.000 VND cho số phút vượt quá 15 và nhóm từ 90 phút trở lên
  cố định 200.000 VND.
- **SC-007**: 100% đơn nghỉ xung đột cùng cơ sở và bộ phận/vị trí bị chặn khi gửi và khi duyệt; đơn
  ở cơ sở khác không bị chặn bởi người nghỉ cùng ngày ngoài phạm vi.
- **SC-008**: 100% ngày `OFF`/ngày lễ Tết do quản lý set không tạo phạt thiếu check-in, đi muộn,
  thiếu báo cáo và không tính vào ngưỡng nghỉ quá 5 ngày/tháng.
- **SC-009**: Video upload/conversion/provider failure retry 100 lần không chuyển trạng thái READY giả,
  không tạo media/violation trùng và giữ được recovery path cho người dùng.
- **SC-010**: Retry 100 lần khi chốt lịch nghỉ, xác nhận nộp phạt hoặc hoàn tiền không tạo lịch nghỉ,
  xác nhận tiền hoặc hoàn tiền lặp ngoài ý muốn.
- **SC-011**: Attendance source cho KPI trả đúng tỷ lệ đúng giờ từ dữ liệu đã xác nhận, trả `null`
  khi thiếu nguồn và đạt p95 đọc dưới 500 ms trong load profile chuẩn trước production.
- **SC-012**: Khi tổng lịch nghỉ/nghỉ đột xuất đã duyệt vượt 5 ngày/tháng, quản lý nhận đúng một
  nhắc nhở idempotent và nhân viên được đánh dấu nghỉ quá hạn trong tháng.
- **SC-013**: 100% reminder trước ca trong test chạy tại mốc 15 phút trước ca chỉ tag nhân viên chưa check-in,
  không tag người đã check-in/OFF/nghỉ hợp lệ và 100 lần retry chỉ tạo một outbox effect cho cùng tenant/cơ sở/ngày/ca.
- **SC-014**: 100% cảnh báo check-in lần cuối trong test chạy tại 11:00 tenant-local chỉ tag nhân viên còn thiếu
  check-in cho ngày làm việc, không tag người đã check-in/OFF/nghỉ hợp lệ và 100 lần retry chỉ tạo một outbox effect
  cho cùng tenant/cơ sở/ngày/ca/mốc cutoff.
- **SC-015**: Module gate chỉ được mở khi format, lint, typecheck, contract, migration, unit,
  integration, worker retry/concurrency, tenant-isolation, media lifecycle, coverage/build và load smoke
  liên quan đều PASS cục bộ/CI không cần credential cloud thật.

## Assumptions

- Module 1 đã ổn định tenant, membership, branch-scoped RBAC, assignment history, dynamic forms,
  media, chat, notification, audit, idempotency và realtime/action-item foundation.
- Module 2 đã đóng gate và đang chờ Module 3 cung cấp nguồn attendance authoritative cho KPI
  `ON_TIME_RATE`; Module 3 không sửa ngược KPI history đã đóng.
- Nhân viên MVP chỉ có đúng một cơ sở làm việc hiện hành tại một thời điểm. Nếu dữ liệu sai, Module 3
  fail-safe giống Module 2 thay vì tự chọn cơ sở.
- Workflow configuration trong Module 3 chỉ phục vụ các đơn đổi ca, xin đi muộn, lịch nghỉ và nghỉ
  đột xuất; giao diện/workflow builder tổng quát nằm ngoài MVP.
- Module 3 MVP chưa quản lý quỹ phép/số dư ngày phép. Nếu công ty bổ sung chính sách ngày phép,
  phần này sẽ cần feature spec riêng hoặc clarification mới trước khi implement.
- Công ty vận hành mặc định không nghỉ hằng tuần; ngày `OFF`/lễ Tết chỉ xuất hiện khi quản lý set
  trong hệ thống và phải được version/audit để tránh phạt nhầm nhân viên.
- Các mức phạt trong PRD là default policy cho tenant mẫu. Skill reference cho X/Y/Z/Max được hiểu là
  khả năng cấu hình tenant, nhưng PRD là nguồn sự thật khi có khác biệt.
- Nhóm chat chung được hiểu là kênh nội bộ tenant/công ty đã có trong Module 1; Module 3 ghi nhận
  bằng chứng báo trước từ kênh hoặc request source có thẩm quyền, không dùng Telegram làm hệ thống nguồn.
- Module 3 tạo tín hiệu ảnh hưởng hàng đợi nhận khách khi đi muộn, nhưng logic booking/queue chi tiết
  thuộc Module 4.
- MVP quản lý sổ phạt nội bộ, không tự động trừ lương, không tích hợp payroll và không tích hợp cổng
  thanh toán.
- Local/CI dùng storage, push và notification test doubles; production adapter thật cần rehearsal trước
  go-live nhưng không chặn specification/plan.
