# Feature Specification: Nhóm chat làm vật chứa module

**Feature Branch**: `007-chat-module-groups`

**Created**: 2026-08-12

**Status**: Draft

**Input**: Biến sản phẩm thành nền tảng chat kiểu Telegram, trong đó mỗi nhóm chat có thể được
gắn đúng một module nghiệp vụ (chấm công, KPI, booking) hoặc không gắn gì và chỉ là nhóm chat
thường.

## Context

Hôm nay người dùng phải rời khỏi cuộc trò chuyện để chấm công, báo KPI hay xem lịch khách. Trên
các nền tảng chat phổ thông, cách vá lỗ hổng này là thêm bot vào nhóm — nhưng bot là một danh
tính ngoài, không hiểu ai là ai trong tổ chức, và mọi quyền hạn phải cấu hình lại từ đầu bên
trong bot.

Tính năng này thay bot bằng chính hệ thống: người quản trị một nhóm chọn nhóm đó phục vụ module
nào, và module xuất hiện ngay trong nhóm với đúng danh tính, đúng phạm vi tenant và đúng quyền
mà tổ chức đã cấp.

Ranh giới này thay đổi một giả định đã ghi ở Module 6 rằng "chat là tính năng hỗ trợ, không phải
nguồn dữ liệu nghiệp vụ chính thức". Sau Module 7, nhóm chat trở thành **bề mặt** để thao tác
nghiệp vụ. Nó vẫn không trở thành **nguồn** dữ liệu nghiệp vụ: quyền quyết định vẫn thuộc
backend của từng module, và tenant vẫn là ranh giới sở hữu dữ liệu.

Ba khác biệt so với mô hình phân quyền hiện có, và là lý do tính năng này cần một module riêng:

1. Quyền hiện được tính theo tổ chức và chi nhánh. Tính năng này cần quyền tính theo **từng
   nhóm**: cùng một người có thể là quản trị nhóm A và chỉ là thành viên nhóm B.
2. Quan hệ thành viên kênh hiện chỉ có hai bậc. Mô hình nghiệp vụ cần ba bậc và cần khái niệm
   chuyển giao quyền quản trị.
3. Việc gắn module là hành vi **uỷ nhiệm của chủ doanh nghiệp**, không phải hệ quả của việc tạo
   nhóm. Người tạo nhóm và người được phép gắn module là hai vai khác nhau.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Nhóm có người chịu trách nhiệm rõ ràng (Priority: P1)

Người tạo một nhóm trở thành quản trị viên duy nhất của nhóm đó. Quản trị viên bổ nhiệm và bãi
nhiệm quản lý, thêm và loại thành viên, và khi cần có thể chuyển hẳn quyền quản trị cho người
khác. Vai trò của một người được tính riêng cho từng nhóm.

**Why this priority**: Không có chủ thể chịu trách nhiệm thì không thể nói ai được phép gắn
module, ai được phép loại người khác. Mọi câu chuyện còn lại đều dựa trên bậc thang này.

**Independent Test**: Tạo nhóm, kiểm tra người tạo là quản trị viên; bổ nhiệm một quản lý; loại
một thành viên; chuyển quyền quản trị; xác nhận người cũ không còn thao tác quản trị được. Toàn
bộ diễn ra không cần module nào tồn tại.

**Acceptance Scenarios**:

1. **Given** một thành viên tenant tạo nhóm mới, **When** nhóm được tạo, **Then** người đó là
   quản trị viên của nhóm và là người duy nhất giữ vai trò đó.
2. **Given** một người là quản trị nhóm A và thành viên thường nhóm B, **When** người đó thao
   tác quản trị ở nhóm B, **Then** hệ thống từ chối, và thao tác tương tự ở nhóm A vẫn được chấp
   nhận.
3. **Given** một nhóm có quản trị viên, **When** quản trị viên chuyển quyền cho một thành viên
   khác, **Then** nhóm vẫn có đúng một quản trị viên, người nhận có toàn quyền quản trị, và người
   chuyển trở thành quản lý.
4. **Given** hai yêu cầu bổ nhiệm quản trị viên gửi đồng thời cho cùng một nhóm, **When** cả hai
   được xử lý, **Then** nhóm vẫn chỉ có đúng một quản trị viên và yêu cầu còn lại thất bại có
   thông báo rõ ràng.
5. **Given** một quản trị viên là người cuối cùng còn lại trong nhóm, **When** người đó rời
   nhóm, **Then** hệ thống từ chối cho tới khi quyền quản trị được chuyển cho người khác.

---

### User Story 2 - Chủ doanh nghiệp kiểm soát ai được gắn module (Priority: P1)

Chủ doanh nghiệp uỷ nhiệm cho từng cá nhân quyền gắn module vào nhóm. Người không được uỷ nhiệm
vẫn tạo được nhóm và vẫn trò chuyện bình thường, nhưng không thấy tuỳ chọn gắn module.

**Why this priority**: Module chạm vào dữ liệu chấm công, KPI và lịch khách của cả doanh nghiệp.
Nếu bất kỳ ai tạo nhóm cũng gắn được module thì quyền kiểm soát dữ liệu doanh nghiệp bị chuyển
xuống cho từng nhân viên.

**Independent Test**: Uỷ nhiệm cho một người, xác nhận người đó thấy và dùng được tuỳ chọn gắn
module; thu hồi uỷ nhiệm, xác nhận tuỳ chọn biến mất và mọi yêu cầu gắn module bị backend từ
chối. Kiểm được mà không cần module nào thực sự chạy.

**Acceptance Scenarios**:

1. **Given** một thành viên chưa được uỷ nhiệm, **When** người đó mở màn hình cấu hình nhóm mình
   quản trị, **Then** không có tuỳ chọn gắn module nào hiển thị.
2. **Given** một thành viên chưa được uỷ nhiệm, **When** người đó gửi thẳng yêu cầu gắn module,
   **Then** backend từ chối và ghi nhận sự việc.
3. **Given** một thành viên đã được uỷ nhiệm nhưng không phải quản trị của nhóm đó, **When**
   người đó gắn module cho nhóm, **Then** hệ thống từ chối, vì cần đồng thời uỷ nhiệm cấp doanh
   nghiệp và vai trò quản trị của chính nhóm đó.
4. **Given** uỷ nhiệm bị thu hồi sau khi module đã được gắn, **When** thu hồi có hiệu lực,
   **Then** module đã gắn vẫn hoạt động nhưng người đó không gắn hay gỡ module được nữa.
5. **Given** một người dùng chưa đăng ký doanh nghiệp nào, **When** người đó tạo nhóm, **Then**
   nhóm hoạt động như nhóm chat thường và không có khái niệm module.

---

### User Story 3 - Gắn một module cho nhóm (Priority: P1)

Quản trị viên nhóm, nếu được uỷ nhiệm, chọn một module cho nhóm. Nhóm nhận đúng một module hoặc
không nhận module nào. Thành viên nhóm nhìn thấy nhóm này phục vụ việc gì.

**Why this priority**: Đây là hành vi trung tâm của cả tính năng.

**Independent Test**: Gắn module cho một nhóm, xác nhận trạng thái nhóm phản ánh đúng; thử gắn
module thứ hai, xác nhận bị từ chối; xác nhận danh sách hội thoại hiển thị module của nhóm.

**Acceptance Scenarios**:

1. **Given** một nhóm chưa có module và một quản trị viên được uỷ nhiệm, **When** người đó chọn
   module chấm công, **Then** nhóm được ghi nhận phục vụ chấm công và cả nhóm nhìn thấy điều đó.
2. **Given** một nhóm đã gắn module chấm công, **When** ai đó cố gắn thêm module KPI, **Then**
   hệ thống từ chối và nêu rõ mỗi nhóm chỉ phục vụ một module.
3. **Given** một nhóm đã gắn module, **When** một thành viên xem danh sách hội thoại, **Then**
   nhóm đó hiển thị dấu hiệu module kèm theo, phân biệt được với nhóm chat thường.
4. **Given** một nhóm thuộc tenant A, **When** một thành viên của tenant B truy cập nhóm đó bằng
   bất kỳ đường nào, **Then** hệ thống từ chối và không tiết lộ sự tồn tại của nhóm.
5. **Given** một module được gắn, **When** kiểm tra lịch sử, **Then** có bản ghi ai gắn, gắn lúc
   nào, và module nào, không thể sửa lại.

---

### User Story 4 - Làm việc với module ngay trong nhóm (Priority: P2)

Thành viên của một nhóm đã gắn module thực hiện thao tác nghiệp vụ của module đó ngay trong cuộc
trò chuyện, thay vì rời sang màn hình khác. Kết quả thao tác xuất hiện trong dòng hội thoại để
cả nhóm cùng thấy.

**Why this priority**: Đây là giá trị người dùng cảm nhận được, nhưng chỉ có ý nghĩa sau khi ba
câu chuyện trên đã đứng vững.

**Independent Test**: Trong một nhóm gắn module chấm công, thực hiện một lượt chấm công và xác
nhận nó được ghi nhận đúng như khi làm từ màn hình chấm công, đồng thời xuất hiện trong dòng hội
thoại.

**Acceptance Scenarios**:

1. **Given** một nhóm gắn module chấm công, **When** một thành viên chấm công từ trong nhóm,
   **Then** kết quả giống hệt khi thao tác từ màn hình chấm công, và tuân thủ đúng quyền, phạm vi
   chi nhánh và chính sách hiện hành.
2. **Given** một nhóm gắn module, **When** một thành viên không có quyền nghiệp vụ tương ứng mở
   nhóm, **Then** người đó vẫn trò chuyện được nhưng không thao tác được chức năng module.
3. **Given** một thao tác module thành công, **When** dòng hội thoại được tải lại, **Then** bản
   ghi thao tác hiển thị đúng một lần và không bị nhân bản khi kết nối lại.
4. **Given** một nhóm chưa gắn module, **When** thành viên mở nhóm, **Then** không có bề mặt
   nghiệp vụ nào xuất hiện.
5. **Given** một thao tác module bị gián đoạn rồi thử lại, **When** lần thử thứ hai hoàn tất,
   **Then** chỉ tạo ra đúng một hiệu ứng nghiệp vụ.

---

### User Story 5 - Gỡ module khỏi nhóm (Priority: P2)

Quản trị viên được uỷ nhiệm gỡ module khỏi nhóm. Nhóm trở lại là nhóm chat thường. Dữ liệu
nghiệp vụ đã phát sinh không biến mất khỏi hệ thống.

**Why this priority**: Gắn được mà không gỡ được là một cái bẫy vận hành; nhưng nó chỉ phát sinh
sau khi việc gắn đã dùng thật.

**Independent Test**: Gỡ module khỏi một nhóm đã có dữ liệu phát sinh, xác nhận bề mặt nghiệp vụ
biến mất, nhóm vẫn chat được, và dữ liệu cũ vẫn truy được từ module tương ứng.

**Acceptance Scenarios**:

1. **Given** một nhóm đã gắn module và có dữ liệu phát sinh, **When** quản trị viên được uỷ nhiệm
   gỡ module, **Then** bề mặt nghiệp vụ biến mất khỏi nhóm và nhóm vẫn hoạt động như nhóm chat.
2. **Given** module vừa bị gỡ, **When** kiểm tra dữ liệu nghiệp vụ đã phát sinh, **Then** dữ liệu
   vẫn còn trong module tương ứng và vẫn truy vết được về nhóm đã sinh ra nó.
3. **Given** một nhóm vừa bị gỡ module, **When** quản trị viên gắn lại đúng module đó, **Then**
   hệ thống chấp nhận và lịch sử ghi nhận cả hai lần gắn cùng lần gỡ ở giữa.
4. **Given** một người không được uỷ nhiệm, **When** người đó cố gỡ module, **Then** hệ thống từ
   chối.

---

### Edge Cases

- Một người vừa là nhân viên công ty X vừa có doanh nghiệp riêng: vai trò nhóm, uỷ nhiệm và danh
  sách module phải tính theo đúng tenant đang chọn, không rò rỉ giữa hai tenant.
- Quản trị viên nhóm bị đình chỉ hoặc rời khỏi tenant trong khi vẫn là quản trị của nhóm.
- Thành viên bị loại khỏi nhóm ngay khi đang thao tác module dở dang.
- Uỷ nhiệm hết hiệu lực đúng lúc một yêu cầu gắn module đang được xử lý.
- Nhóm gắn module chấm công nhưng có thành viên thuộc nhiều chi nhánh khác nhau.
- Module bị gỡ trong khi một thành viên khác đang mở bề mặt nghiệp vụ của module đó.
- Hai người cùng lúc được chuyển quyền quản trị của cùng một nhóm.
- Nhóm hệ thống (kênh chung của tenant, kênh theo chi nhánh) không được phép gắn module thủ công.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Mỗi nhóm MUST có đúng một quản trị viên tại mọi thời điểm. Hệ thống MUST NOT cho
  phép trạng thái nhóm có hai quản trị viên hoặc không có quản trị viên nào.
- **FR-002**: Người tạo nhóm MUST trở thành quản trị viên đầu tiên của nhóm đó.
- **FR-003**: Quan hệ thành viên nhóm MUST hỗ trợ ba bậc: quản trị viên, quản lý, thành viên.
- **FR-004**: Quản trị viên MUST có thể chuyển quyền quản trị cho một thành viên khác của cùng
  nhóm, và sau khi chuyển, người chuyển MUST giữ vai trò quản lý chứ không bị loại khỏi nhóm.
- **FR-005**: Vai trò của một người trong một nhóm MUST được tính độc lập với vai trò của người
  đó ở các nhóm khác và độc lập với vai trò cấp tổ chức.
- **FR-006**: Quản trị viên MUST có thể bổ nhiệm và bãi nhiệm quản lý, thêm và loại thành viên
  trong nhóm mình quản trị.
- **FR-007**: Quản trị viên MUST NOT rời nhóm khi chưa chuyển quyền quản trị cho người khác.
- **FR-008**: Hệ thống MUST có một quyền cấp doanh nghiệp riêng cho hành vi gắn hoặc gỡ module,
  và quyền này MUST do chủ doanh nghiệp uỷ nhiệm cho từng cá nhân.
- **FR-009**: Gắn hoặc gỡ module MUST yêu cầu đồng thời quyền uỷ nhiệm cấp doanh nghiệp và vai
  trò quản trị của chính nhóm đó.
- **FR-010**: Tuỳ chọn module MUST NOT xuất hiện với người dùng chưa thuộc bất kỳ doanh nghiệp
  đã đăng ký nào; nhóm của họ MUST hoạt động như nhóm chat thường.
- **FR-011**: Một nhóm MUST gắn được nhiều nhất một module tại một thời điểm.
- **FR-012**: Hệ thống MUST hiển thị module đang gắn của nhóm trên danh sách hội thoại, phân
  biệt được với nhóm không gắn module.
- **FR-013**: Nhóm đã gắn module MUST cung cấp bề mặt thao tác của module đó ngay trong cuộc trò
  chuyện.
- **FR-014**: Thao tác nghiệp vụ thực hiện từ trong nhóm MUST đi qua đúng quy tắc quyền, phạm vi
  chi nhánh và chính sách của module tương ứng, giống hệt khi thao tác từ màn hình riêng của
  module. Việc là thành viên nhóm MUST NOT tự nó cấp thêm quyền nghiệp vụ nào.
- **FR-015**: Thành viên không có quyền nghiệp vụ của module MUST vẫn trò chuyện được trong nhóm.
- **FR-016**: Thao tác nghiệp vụ khởi phát từ nhóm MUST idempotent khi thử lại và MUST NOT tạo
  hiệu ứng trùng.
- **FR-017**: Quản trị viên được uỷ nhiệm MUST có thể gỡ module khỏi nhóm, và sau khi gỡ, nhóm
  MUST tiếp tục hoạt động như nhóm chat thường.
- **FR-018**: Gỡ module MUST NOT xoá dữ liệu nghiệp vụ đã phát sinh, và dữ liệu đó MUST vẫn truy
  vết được về nhóm đã sinh ra nó. [NEEDS CLARIFICATION: sau khi gỡ, dữ liệu đã phát sinh nên
  tiếp tục hiển thị trong nhóm ở dạng chỉ đọc, hay ẩn khỏi nhóm và chỉ còn xem được từ màn hình
  riêng của module?]
- **FR-019**: Mọi thay đổi vai trò nhóm, chuyển quyền quản trị, uỷ nhiệm quyền module, gắn và gỡ
  module MUST được ghi lại kèm người thực hiện, thời điểm do backend quyết định, và giá trị
  trước/sau, và MUST NOT bị ghi đè.
- **FR-020**: Kênh hệ thống do nền tảng tạo ra MUST NOT được gắn module bằng thao tác thủ công.
- **FR-021**: Dữ liệu do module trong nhóm sinh ra MUST thuộc về tenant của nhóm và MUST NOT
  truy cập được từ tenant khác. [NEEDS CLARIFICATION: nhóm có trở thành một trục phân phạm vi
  dữ liệu mới hay không — tức dữ liệu chấm công phát sinh trong nhóm có được ghi nhận là "của
  nhóm" bên cạnh tenant và chi nhánh, hay nhóm chỉ là bề mặt thao tác còn dữ liệu vẫn hoàn toàn
  thuộc tenant và chi nhánh như hiện nay?]
- **FR-022**: Phạm vi này MUST NOT bao gồm việc tạo module nghiệp vụ mới, thay đổi quy tắc
  nghiệp vụ bên trong các module hiện có, hay cho phép một nhóm phục vụ nhiều module.

### Constitutional & Cross-Cutting Requirements *(mandatory)*

- **CR-001**: Nhóm, vai trò nhóm, uỷ nhiệm quyền module, việc gắn module và mọi dữ liệu nghiệp
  vụ phát sinh MUST gắn với đúng tenant. Truy cập chéo tenant MUST bị backend từ chối và MUST có
  kịch bản kiểm thử phủ định cho từng đường đi.
- **CR-002**: Quyền cho mọi hành vi quản trị nhóm và gắn/gỡ module MUST do backend quyết định.
  Vai trò nhóm MUST được tính theo từng nhóm; quyền uỷ nhiệm module MUST được tính theo tổ chức.
  Hai lớp này MUST được kiểm tra đồng thời, không thay thế cho nhau.
- **CR-003**: Chuyển quyền quản trị, gắn module, gỡ module và thay đổi uỷ nhiệm MUST là các
  chuyển trạng thái có bản ghi bất biến, có idempotency khi thử lại, và an toàn trong giao dịch.
  Bất biến "đúng một quản trị viên mỗi nhóm" MUST được bảo đảm ở tầng lưu trữ chứ không chỉ bằng
  kiểm tra trong luồng ứng dụng, để hai yêu cầu đồng thời không thể cùng thành công.
- **CR-004**: Danh tính thành viên hiển thị trong nhóm MUST tuân thủ ranh giới riêng tư hiện
  hành; việc gắn module MUST NOT làm lộ dữ liệu nghiệp vụ của người khác cho thành viên không có
  quyền tương ứng.
- **CR-005**: Hệ thống MUST đo được số nhóm theo module, tỉ lệ thao tác nghiệp vụ khởi phát từ
  nhóm bị từ chối vì thiếu quyền, và độ trễ hiển thị bề mặt module, bằng dữ liệu không chứa nội
  dung tin nhắn hay dữ liệu cá nhân.
- **CR-006**: Mỗi FR và CR trong tài liệu này MUST được truy vết tới kiểm thử đơn vị, contract,
  tích hợp, cách ly tenant, migration hoặc đầu-cuối phù hợp trước khi được đánh dấu hoàn thành.

### Key Entities *(include if feature involves data)*

- **Nhóm chat**: cuộc trò chuyện thuộc một tenant, có thể phục vụ nhiều nhất một module nghiệp
  vụ hoặc không phục vụ module nào.
- **Vai trò trong nhóm**: quan hệ giữa một thành viên tenant và một nhóm, ở một trong ba bậc
  quản trị viên, quản lý, thành viên. Ràng buộc: mỗi nhóm đúng một quản trị viên.
- **Liên kết module của nhóm**: ghi nhận nhóm đang phục vụ module nào, ai đã gắn và từ khi nào.
- **Uỷ nhiệm quyền module**: quyền cấp doanh nghiệp cho phép một cá nhân gắn hoặc gỡ module,
  do chủ doanh nghiệp cấp và thu hồi được, có hiệu lực theo thời gian.
- **Nhật ký quản trị nhóm**: chuỗi bản ghi bất biến về thay đổi vai trò, chuyển quyền quản trị,
  gắn và gỡ module.
- **Thao tác nghiệp vụ khởi phát từ nhóm**: một hành vi của module được thực hiện từ trong nhóm,
  giữ tham chiếu tới nhóm đã sinh ra nó để truy vết.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% nhóm trong bộ kiểm thử luôn có đúng một quản trị viên, kể cả sau các chuỗi
  thao tác chuyển quyền, bãi nhiệm và rời nhóm xen kẽ.
- **SC-002**: 100% cặp yêu cầu bổ nhiệm quản trị viên gửi đồng thời cho cùng một nhóm kết thúc
  với đúng một yêu cầu thành công.
- **SC-003**: 100% yêu cầu gắn hoặc gỡ module từ người thiếu uỷ nhiệm cấp doanh nghiệp hoặc
  thiếu vai trò quản trị nhóm đều bị backend từ chối, trên mọi đường truyền được hỗ trợ.
- **SC-004**: 100% nhóm trong bộ kiểm thử có nhiều nhất một module tại mọi thời điểm.
- **SC-005**: 100% người dùng chưa thuộc doanh nghiệp đã đăng ký nào đều không nhận được tuỳ chọn
  module, và mọi yêu cầu gắn module của họ đều bị từ chối.
- **SC-006**: 100% thao tác nghiệp vụ khởi phát từ trong nhóm cho ra kết quả giống hệt thao tác
  tương đương từ màn hình riêng của module, trên toàn bộ bộ mẫu kiểm thử.
- **SC-007**: 100% thao tác nghiệp vụ khởi phát từ nhóm bởi người thiếu quyền nghiệp vụ đều bị
  từ chối, trong khi người đó vẫn gửi và nhận được tin nhắn trong nhóm.
- **SC-008**: 100% thao tác nghiệp vụ bị gián đoạn rồi thử lại đều tạo ra đúng một hiệu ứng.
- **SC-009**: 100% dữ liệu nghiệp vụ phát sinh trước khi gỡ module vẫn truy được sau khi gỡ, và
  vẫn truy vết được về nhóm đã sinh ra nó.
- **SC-010**: 100% thao tác quản trị nhóm và gắn/gỡ module trong bộ kiểm thử để lại bản ghi có
  người thực hiện, thời điểm phía server và giá trị trước/sau, và 0 bản ghi bị ghi đè.
- **SC-011**: 100% yêu cầu chéo tenant tới nhóm, vai trò nhóm hoặc dữ liệu module của nhóm đều bị
  từ chối mà không tiết lộ sự tồn tại của tài nguyên.
- **SC-012**: Người dùng nhận ra một nhóm phục vụ module nào ngay trên danh sách hội thoại, không
  cần mở nhóm, ở 100% nhóm có gắn module trong bộ kiểm thử.

## Assumptions

- Nhóm chat là **bề mặt** thao tác nghiệp vụ, không phải nguồn dữ liệu nghiệp vụ. Backend của
  từng module vẫn là nơi quyết định trạng thái, thời điểm và tính hợp lệ. Giả định này thay thế
  câu tương ứng ở Module 6, vốn viết trước khi mô hình sản phẩm được làm rõ.
- Ba module đưa vào phạm vi là các module đã tồn tại: chấm công, KPI, booking. Không tạo module
  mới trong phạm vi này.
- Quy tắc nghiệp vụ bên trong từng module giữ nguyên. Tính năng này chỉ thêm một lối vào mới và
  một lớp kiểm soát ai được mở lối vào đó.
- Cơ chế nhiều tenant cho một người dùng đã tồn tại và được tái sử dụng; người dùng luôn thao tác
  trong bối cảnh đúng một tenant tại một thời điểm.
- Thành viên của một nhóm phải là thành viên đang hoạt động của tenant chứa nhóm đó. Việc mời
  người ngoài tenant vào nhóm nằm ngoài phạm vi.
- Phạm vi chi nhánh của thao tác nghiệp vụ do chính module quyết định theo quy tắc sẵn có, không
  do nhóm quyết định. Một nhóm có thành viên thuộc nhiều chi nhánh vẫn hợp lệ.
- Hạ tầng chat đã kiểm chứng ở Module 5 và phần đã hoàn thành của Module 6 được tái sử dụng, gồm
  danh sách hội thoại, đếm chưa đọc và kiểm tra quyền trên kênh realtime.

## Dependencies

- Module 1 cung cấp tenant, thành viên tenant, vai trò và quyền cấp tổ chức.
- Module 3 cung cấp chấm công, Module 2 cung cấp KPI, Module 4 cung cấp booking. Mỗi module giữ
  nguyên quy tắc quyền và phạm vi của mình.
- Hạ tầng chat hiện có: kênh, quan hệ thành viên kênh, tin nhắn, kênh realtime, danh sách hội
  thoại và số chưa đọc.
- Các yêu cầu FR-004 và FR-007 của Module 6 sẽ phải được diễn giải lại theo mô hình vai trò nhóm
  của tài liệu này; hai module cần được điều phối chứ không triển khai song song một cách độc lập.
