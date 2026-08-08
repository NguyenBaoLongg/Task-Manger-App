# Feature Specification: Chat Hardening and Delivery Integrity

**Feature Branch**: `006-chat-hardening`

**Created**: 2026-08-08

**Status**: Draft

**Input**: User description: "bạn kiểm tra lại và check lỗi cho tôi ở module 6"

## Context

Module 5 shipped tenant-scoped chat as a supporting feature: channels, membership, text
messages, cursor pagination and realtime delivery. An audit of that implementation found
defects that lose messages, leak messages to removed members, and leave two declared
capabilities with no working path. This feature closes those defects and completes the
capabilities the existing data model already anticipates.

Audit findings that motivate each requirement:

| # | Finding | Evidence |
|---|---|---|
| A1 | The socket transport skipped the RBAC gate the HTTP routes apply | Fixed before this spec, commit `8c89786`; retained here as a regression requirement |
| A2 | The client message reconciler drops messages | Reproduced: two authors reusing one client message id produced 2 messages in, 1 out |
| A3 | A member removed from a channel keeps receiving its messages | No leave path exists in the realtime layer; rooms are also restored on reconnect without re-authorization |
| A4 | Unread state has storage but no behavior | `lastReadMessageId` exists on channel membership and is referenced by no application code |
| A5 | Attachments are declared but unreachable | The media purpose enum carries `CHAT_ATTACHMENT`; no send path accepts media |
| A6 | Client ordering is weaker than server ordering | Server orders by creation time **and** identifier; the client orders by creation time alone, so ties are non-deterministic |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Không mất tin nhắn (Priority: P1)

Hai nhân sự nhắn trong cùng một kênh. Mọi tin nhắn được backend chấp nhận đều phải hiển
thị trên máy người nhận, đúng một lần, đúng thứ tự backend quy định — kể cả khi hai người
tình cờ dùng trùng định danh tin nhắn phía client, hoặc khi nhiều tin được tạo trong cùng
một mốc thời gian.

**Why this priority**: Mất tin nhắn im lặng là lỗi nghiêm trọng nhất của một hệ thống chat.
Người dùng không có cách nào biết mình đã mất tin, nên không thể tự khắc phục.

**Independent Test**: Cho hai tài khoản gửi tin có cùng định danh client vào một kênh, và
cho một tài khoản gửi nhiều tin trong cùng một mili-giây. Xác nhận số tin hiển thị bằng số
tin backend lưu, và thứ tự trên mọi thiết bị giống nhau.

**Acceptance Scenarios**:

1. **Given** hai nhân sự khác nhau cùng gửi tin với một định danh client trùng nhau,
   **When** cả hai tin được backend chấp nhận, **Then** người nhận thấy đủ hai tin, không
   tin nào bị gộp hoặc biến mất.
2. **Given** nhiều tin nhắn có cùng mốc thời gian tạo, **When** danh sách được hiển thị,
   **Then** thứ tự giống hệt thứ tự backend trả về và giống nhau trên mọi thiết bị.
3. **Given** một tin lạc quan đang chờ xác nhận từ server, **When** server xác nhận,
   **Then** tin lạc quan được thay bằng bản chính thức chứ không tạo thành hai dòng.
4. **Given** ứng dụng mất kết nối rồi kết nối lại, **When** đồng bộ lại kênh, **Then**
   không tin nào bị nhân đôi và không tin nào bị thiếu.

---

### User Story 2 - Rời kênh là ngừng nhận tin (Priority: P1)

Khi một người bị đưa ra khỏi kênh hoặc bị thu hồi quyền đọc, họ phải ngừng nhận tin nhắn
mới của kênh đó ngay lập tức, không phải chờ tới lúc thoát ứng dụng.

**Why this priority**: Đây là rò rỉ dữ liệu qua ranh giới phân quyền. Người đã bị loại vẫn
đọc được nội dung nội bộ, vi phạm chính nguyên tắc tenant isolation của dự án.

**Independent Test**: Cho một người tham gia kênh, giữ kết nối mở, rồi loại họ khỏi kênh từ
tài khoản quản lý. Gửi tin mới và xác nhận thiết bị của người đã bị loại không nhận được gì.

**Acceptance Scenarios**:

1. **Given** một người đang mở kênh và giữ kết nối realtime, **When** họ bị loại khỏi kênh,
   **Then** họ ngừng nhận tin mới của kênh đó mà không cần thoát ứng dụng.
2. **Given** một người bị thu hồi quyền đọc chat, **When** kênh phát tin mới, **Then** thiết
   bị của họ không nhận được nội dung tin.
3. **Given** một người bị loại khỏi kênh và mất kết nối tạm thời, **When** kết nối được khôi
   phục trong khoảng cho phép, **Then** quyền được kiểm tra lại và họ không được đưa trở lại
   kênh cũ.
4. **Given** một người chủ động rời kênh, **When** kênh phát tin mới, **Then** họ không nhận
   được tin đó.

---

### User Story 3 - Biết còn bao nhiêu tin chưa đọc (Priority: P2)

Nhân sự nhìn thấy số tin chưa đọc của từng kênh và tổng số trên biểu tượng chat. Khi mở
kênh và đọc tới đâu, số đó giảm tương ứng và đồng bộ sang các thiết bị khác của cùng người.

**Why this priority**: Module 5 đã yêu cầu badge thông báo cho chat nhưng chưa có nguồn dữ
liệu. Không có phần này thì badge chat không thể hoạt động đúng.

**Independent Test**: Gửi một số tin vào kênh khi người nhận đang không mở kênh, kiểm tra số
chưa đọc. Mở kênh, đánh dấu đã đọc, kiểm tra số về 0 và kiểm tra thiết bị thứ hai cũng về 0.

**Acceptance Scenarios**:

1. **Given** có tin mới trong kênh mà người dùng chưa mở, **When** họ xem danh sách kênh,
   **Then** kênh đó hiển thị số tin chưa đọc chính xác.
2. **Given** người dùng đọc tới một tin nhất định, **When** ứng dụng đánh dấu đã đọc,
   **Then** số chưa đọc giảm đúng phần đã đọc và không âm.
3. **Given** cùng một người đăng nhập trên hai thiết bị, **When** họ đọc trên thiết bị thứ
   nhất, **Then** thiết bị thứ hai phản ánh trạng thái đã đọc.
4. **Given** đánh dấu đã đọc được gửi lại nhiều lần do thử lại, **When** backend xử lý,
   **Then** kết quả không đổi và con dấu đã đọc không lùi về tin cũ hơn.
5. **Given** tin nhắn do chính người dùng gửi, **When** tính số chưa đọc, **Then** tin của
   chính họ không bị tính là chưa đọc.

---

### User Story 4 - Gửi ảnh và tệp trong chat (Priority: P2)

Nhân sự đính kèm ảnh hoặc tệp vào tin nhắn để trao đổi nhanh về ca trực, booking hoặc sự cố.
Người nhận xem được nội dung đính kèm trong phạm vi quyền của mình.

**Why this priority**: Trao đổi vận hành thường cần hình ảnh. Hạ tầng lưu trữ media, consent
và liên kết có hạn đã chạy cho chấm công và booking, nên đây là mở rộng chứ không phải xây mới.

**Independent Test**: Gửi một tin có ảnh đính kèm, xác nhận người cùng kênh xem được và người
ngoài kênh nhận trạng thái từ chối an toàn.

**Acceptance Scenarios**:

1. **Given** nhân sự có quyền gửi tin, **When** đính kèm ảnh và gửi, **Then** tin hiển thị
   kèm ảnh cho các thành viên kênh.
2. **Given** một người không thuộc kênh, **When** cố truy cập tệp đính kèm, **Then** backend
   từ chối và không lộ nội dung hay đường dẫn lưu trữ.
3. **Given** quá trình tải lên bị gián đoạn, **When** người dùng thử lại, **Then** không tạo
   ra tin nhắn trùng hoặc tệp mồ côi.
4. **Given** tệp vượt quá giới hạn cho phép hoặc sai định dạng, **When** người dùng gửi,
   **Then** ứng dụng báo lỗi rõ ràng trước khi tải lên.

---

### Edge Cases

- Hai người gửi tin cùng lúc với định danh client trùng nhau.
- Nhiều tin nhắn mang cùng một mốc thời gian tạo.
- Người dùng bị loại khỏi kênh đúng lúc một tin đang được phát đi.
- Người dùng bị loại rồi kết nối lại trong khoảng khôi phục phiên ngắn.
- Đánh dấu đã đọc trỏ tới một tin đã bị xoá, hoặc tới tin cũ hơn con dấu hiện tại.
- Đánh dấu đã đọc đến không đúng thứ tự do mạng chậm.
- Tin nhắn bị xoá trong lúc người khác đang đọc kênh.
- Tệp đính kèm bị xoá theo chính sách lưu trữ trong khi tin nhắn vẫn còn.
- Thiết bị offline dài ngày rồi mở lại, kênh đã có rất nhiều tin mới.
- Kênh bị lưu trữ hoặc đóng trong lúc người dùng đang mở.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST hiển thị đúng một dòng cho mỗi tin nhắn backend đã chấp nhận, và
  MUST NOT gộp hai tin của hai người gửi khác nhau thành một, kể cả khi định danh tin nhắn
  phía client trùng nhau. Phạm vi duy nhất của định danh client là theo từng người gửi, nên
  mọi cơ chế khử trùng ở client MUST dùng đúng phạm vi đó.
- **FR-002**: Thứ tự hiển thị tin nhắn MUST khớp với thứ tự backend quy định và MUST xác định
  duy nhất khi nhiều tin có cùng mốc thời gian tạo.
- **FR-003**: Tin nhắn lạc quan MUST được thay thế bằng bản chính thức khi backend xác nhận,
  không tạo thêm dòng mới.
- **FR-004**: Người bị loại khỏi kênh hoặc bị thu hồi quyền đọc MUST ngừng nhận tin mới của
  kênh đó ngay, không phụ thuộc vào việc họ có ngắt kết nối hay không.
- **FR-005**: Người dùng MUST có thể chủ động rời kênh và ngừng nhận tin của kênh đó.
- **FR-006**: Khi một phiên kết nối được khôi phục sau gián đoạn ngắn, hệ thống MUST kiểm tra
  lại quyền hiện hành trước khi tiếp tục gửi nội dung kênh cho phiên đó.
- **FR-007**: Mọi đường truyền dùng để gửi hoặc đọc tin nhắn MUST áp dụng cùng một bộ quyền;
  không đường nào được nới lỏng hơn đường khác.
- **FR-008**: Hệ thống MUST cung cấp số tin chưa đọc cho từng kênh và tổng số chưa đọc theo
  từng thành viên.
- **FR-009**: Người dùng MUST có thể đánh dấu đã đọc tới một tin nhất định, và trạng thái đó
  MUST đồng bộ trên mọi thiết bị của cùng người trong cùng tenant.
- **FR-010**: Đánh dấu đã đọc MUST idempotent và MUST NOT lùi con dấu về tin cũ hơn khi các
  yêu cầu đến không đúng thứ tự.
- **FR-011**: Tin nhắn do chính người dùng gửi MUST NOT được tính vào số chưa đọc của họ.
- **FR-012**: Badge thông báo chat MUST lấy số liệu từ backend và MUST NOT tăng thêm khi
  nhận trùng sự kiện hoặc khi kết nối lại.
- **FR-013**: Người dùng MUST có thể đính kèm ảnh hoặc tệp vào tin nhắn trong giới hạn định
  dạng và dung lượng được công bố.
- **FR-014**: Truy cập tệp đính kèm MUST bị giới hạn theo quyền và phạm vi kênh, và MUST NOT
  lộ đường dẫn lưu trữ hay khoá đối tượng cho người không có quyền.
- **FR-015**: Tải lên đính kèm bị gián đoạn rồi thử lại MUST NOT tạo tin nhắn trùng hoặc để
  lại tệp mồ côi.
- **FR-016**: Ứng dụng MUST báo lỗi rõ ràng trước khi tải lên nếu tệp sai định dạng hoặc vượt
  giới hạn.
- **FR-017**: Mọi trạng thái lỗi của chat MUST hiển thị an toàn, có mã lỗi và mã tương quan,
  không lộ dữ liệu cá nhân hay bí mật.
- **FR-018**: Phạm vi này MUST NOT bao gồm mã hoá đầu cuối, gọi thoại, gọi video, tìm kiếm
  toàn văn, reaction, chỉnh sửa và xoá tin nhắn.

### Constitutional & Cross-Cutting Requirements *(mandatory)*

- **CR-001**: Mọi kênh, tin nhắn, tệp đính kèm, số chưa đọc và sự kiện realtime MUST gắn với
  đúng tenant. Truy cập chéo tenant MUST bị backend từ chối và MUST có kịch bản kiểm thử phủ định.
- **CR-002**: Quyền đọc và quyền gửi MUST do backend quyết định và MUST được áp dụng như nhau
  trên mọi đường truyền. Việc mất tư cách thành viên kênh MUST có hiệu lực ngay trên các
  kết nối đang mở.
- **CR-003**: Gửi tin, đánh dấu đã đọc và tải lên đính kèm MUST idempotent khi thử lại, và
  MUST NOT tạo hiệu ứng trùng.
- **CR-004**: Tệp đính kèm MUST đi qua luồng cấp quyền có hạn, tuân thủ chính sách lưu trữ và
  xoá, không được coi bản lưu cục bộ là nguồn dữ liệu chính thức, và MUST bị che khỏi log.
- **CR-005**: Hệ thống MUST đo được độ trễ phát tin, tỉ lệ mất kết nối, tỉ lệ thất bại khi
  tải lên và tỉ lệ sự kiện bị loại bỏ, bằng dữ liệu không chứa nội dung tin nhắn hay dữ liệu
  cá nhân.
- **CR-006**: Mỗi FR và CR trong tài liệu này MUST được truy vết tới kiểm thử đơn vị, contract,
  tích hợp, cách ly tenant hoặc đầu-cuối phù hợp trước khi được đánh dấu hoàn thành.

### Key Entities *(include if feature involves data)*

- **Chat Channel**: kênh trao đổi thuộc một tenant, có loại, trạng thái và phạm vi cơ sở.
- **Channel Membership**: quan hệ giữa một thành viên và một kênh, gồm vai trò, thời điểm
  tham gia, thời điểm rời và con dấu đã đọc.
- **Chat Message**: nội dung do một thành viên gửi, gắn với kênh, có định danh phía client
  duy nhất theo từng người gửi và thứ tự do server quyết định.
- **Message Attachment**: tệp gắn với một tin nhắn, có mục đích lưu trữ riêng, trạng thái tải
  lên và quyền truy cập theo kênh.
- **Unread State**: số tin chưa đọc của một thành viên tại một kênh, dẫn xuất từ con dấu đã
  đọc và dòng tin nhắn của kênh.
- **Realtime Session**: phiên kết nối của một thiết bị, gồm danh sách kênh đang theo dõi và
  quyền hiện hành tại thời điểm kiểm tra gần nhất.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% tin nhắn được backend chấp nhận trong bộ kiểm thử đều hiển thị đúng một
  lần trên máy người nhận, bao gồm cả các trường hợp trùng định danh client giữa hai người gửi.
- **SC-002**: 100% tin nhắn trong bộ kiểm thử có thứ tự hiển thị giống nhau trên mọi thiết bị
  và giống thứ tự backend trả về, kể cả khi trùng mốc thời gian.
- **SC-003**: 100% trường hợp mất tư cách thành viên kênh hoặc mất quyền đọc trong bộ kiểm thử
  dẫn tới việc ngừng nhận tin trong vòng 10 giây, không cần thao tác từ người dùng.
- **SC-004**: 100% yêu cầu đọc và gửi tin ngoài phạm vi quyền bị backend từ chối, trên mọi
  đường truyền được hỗ trợ, và không lộ nội dung tin nhắn.
- **SC-005**: Số tin chưa đọc hiển thị khớp với trạng thái backend trong tối thiểu 19/20 lượt
  kiểm thử có gửi, đọc, ngắt kết nối và kết nối lại xen kẽ.
- **SC-006**: 100% lượt đánh dấu đã đọc lặp lại hoặc đến sai thứ tự trong bộ kiểm thử đều không
  làm thay đổi kết quả và không lùi con dấu.
- **SC-007**: 100% mẫu tải lên đính kèm bị gián đoạn rồi thử lại đều kết thúc với đúng một tin
  nhắn và không để lại tệp mồ côi.
- **SC-008**: 100% yêu cầu truy cập tệp đính kèm từ người ngoài kênh bị từ chối và không trả
  về đường dẫn lưu trữ.
- **SC-009**: Tin nhắn gửi thành công xuất hiện trên thiết bị người nhận đang kết nối trong
  dưới 3 giây ở tối thiểu 19/20 lượt kiểm thử trên hồ sơ mạng bình thường.
- **SC-010**: 0 bản ghi log hoặc dữ liệu đo lường trong bộ kiểm thử chứa nội dung tin nhắn,
  đường dẫn lưu trữ hoặc dữ liệu cá nhân.

## Assumptions

- Chat vẫn là tính năng hỗ trợ, không phải nguồn dữ liệu nghiệp vụ chính thức. Ranh giới này
  giữ nguyên từ Module 5.
- Hạ tầng lưu trữ media, consent và liên kết có hạn đã dùng cho chấm công và booking được tái
  sử dụng cho đính kèm chat, không xây mới.
- Cơ chế phân quyền và ranh giới tenant của Module 1 giữ nguyên; tính năng này chỉ áp dụng
  đúng cơ chế đó trên các đường đi còn thiếu.
- Số chưa đọc dẫn xuất từ con dấu đã đọc sẵn có trên quan hệ thành viên kênh, không cần bảng
  trạng thái đọc riêng cho từng tin.
- Đẩy thông báo tới thiết bị vẫn dùng bộ điều hợp cục bộ trong môi trường phát triển và kiểm
  thử; không cần thông tin xác thực nhà cung cấp thật để nghiệm thu.
- Giới hạn định dạng và dung lượng tệp đính kèm theo chuẩn hiện hành của dự án cho media
  nghiệp vụ, không đặt ngưỡng riêng cho chat.
- Khối lượng mục tiêu là quy mô doanh nghiệp vừa: hàng chục nghìn tin nhắn mỗi tenant, không
  phải quy mô mạng xã hội công cộng.
