# Feature Specification: Mời thành viên & đăng nhập Google (mobile)

**Feature Branch**: `008-member-invite-google-auth`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Member invitation & Google sign-in for the mobile app (specs/008-member-invite-google-auth). Backend already has the APIs. Three deliverables: (1) sign-in screen logs in via Google only (replace the internal fake button; keep a dev fallback when Google OAuth is not configured); (2) 'Mời thành viên' screen: pick a role from GET /tenants/:tenantId/roles, create an invitation via POST /tenants/:tenantId/invitations (member.invite), show the generated code and share it via the OS share sheet; (3) 'Tham gia công ty' screen: enter an invitation code, call POST /invitations/accept (requires idempotency-key header + confirmed profile), then refresh tenant list so the new workspace appears. Entry point for invite lives in the Workspace tab (app/(tabs)/workspace.tsx)."

## Clarifications

### Session 2026-09-29

- Q: Chủ sản phẩm có sẵn cấu hình Google Cloud OAuth (client ID) để đăng nhập Google thật ngay không, hay giữ fallback nội bộ khi chưa cấu hình? → A: CÓ SẴN — nối luồng đăng nhập Google thật, bỏ hẳn nút "Đăng nhập nội bộ" giả lập. Cần cấu hình GOOGLE_CLIENT_ID cho API và OAuth client cho app mobile.
- Q: Lối vào "Tham gia công ty" đặt ở đâu? → A: Chỉ hiển thị trên màn hình chọn workspace khi tài khoản chưa thuộc công ty nào (đúng hành trình người mới, không làm rối người đã có công ty).
- Q: Thời hạn lời mời tính thế nào? → A: Cố định 7 ngày kể từ khi tạo; màn hình mời không cần thêm lựa chọn thời hạn.
- Q: Khi nhập mã lời mời nhưng tài khoản chưa có họ tên, sau khi xác nhận họ tên thì hệ thống tự hoàn tất việc tham gia hay người dùng phải nhập lại mã? → A: TỰ HOÀN TẤT — hệ thống giữ mã trong luồng, sau khi xác nhận họ tên thì tự động hoàn tất việc tham gia, không yêu cầu nhập lại mã.
- Q: Ngoài tạo và chia sẻ mã, có cần màn hình danh sách lời mời đã gửi và nút thu hồi không? → A: KHÔNG CẦN trong lần này — chỉ làm tạo + chia sẻ mã; danh sách và thu hồi để giai đoạn sau.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Đăng nhập bằng Google (Priority: P1)

Người dùng mở app, thấy màn hình đăng nhập với nút "Đăng nhập bằng Google", chọn tài
khoản Google của mình rồi vào thẳng màn hình chọn workspace (hoặc xác nhận họ tên nếu
tài khoản mới). Nút đăng nhập nội bộ (giả lập) hiện tại bị thay bằng luồng Google thật.

**Why this priority**: Đăng nhập là cửa vào duy nhất; không có nó thì hai máy không thể
dùng hai tài khoản khác nhau, kéo theo mời thành viên và chat đa người không thể dùng thật.

**Independent Test**: Cài app, bấm "Đăng nhập bằng Google", chọn tài khoản → vào được
workspace. Có thể kiểm thử độc lập không cần hai user story còn lại.

**Acceptance Scenarios**:

1. **Given** app đã được cấu hình đăng nhập Google, **When** người dùng bấm "Đăng nhập bằng Google" và chọn một tài khoản, **Then** người dùng vào màn hình chọn workspace (hoặc xác nhận họ tên nếu tài khoản chưa có họ tên).
2. **Given** tài khoản Google chưa từng đăng nhập hệ thống, **When** đăng nhập lần đầu, **Then** hệ thống tạo tài khoản mới và dẫn người dùng qua bước xác nhận họ tên trước khi chọn workspace.
3. **Given** người dùng hủy màn hình chọn tài khoản Google, **When** quay lại app, **Then** vẫn ở màn hình đăng nhập, không có lỗi hay trạng thái treo.
4. **Given** tài khoản đã bị khóa, **When** đăng nhập, **Then** hiển thị thông báo rõ ràng bằng tiếng Việt.

---

### User Story 2 - Chủ doanh nghiệp mời thành viên (Priority: P2)

Người có quyền mời mở tab Workspace, bấm "Mời thành viên", chọn vai trò cho người sắp
vào, bấm tạo → nhận mã lời mời và chia sẻ mã qua bảng chia sẻ của điện thoại (Zalo,
Messenger, SMS...).

**Why this priority**: Đây là cách duy nhất để người ngoài gia nhập công ty; đứng trước
"Tham gia công ty" vì phải có mã thì mới có người nhận.

**Independent Test**: Đăng nhập bằng tài khoản chủ doanh nghiệp (đã có quyền mời), vào
màn hình mời, chọn vai trò, tạo mã, chia sẻ. Kiểm thử được độc lập với story 3.

**Acceptance Scenarios**:

1. **Given** thành viên có quyền mời thành viên, **When** mở màn hình "Mời thành viên", **Then** thấy danh sách vai trò của công ty và chọn được đúng một vai trò.
2. **Given** đã chọn vai trò, **When** bấm tạo lời mời, **Then** hệ thống hiển thị mã lời mời đầy đủ kèm nút "Chia sẻ".
3. **Given** mã đã hiển thị, **When** bấm "Chia sẻ", **Then** mở bảng chia sẻ của hệ điều hành với nội dung gồm mã và hướng dẫn ngắn.
4. **Given** thành viên không có quyền mời, **When** mở tab Workspace, **Then** không thấy mục "Mời thành viên".
5. **Given** mạng lỗi khi tạo lời mời, **When** bấm thử lại, **Then** không tạo ra hai lời mời trùng cho cùng một thao tác.
6. **Given** mã vừa tạo, **When** người mời cần gửi lại, **Then** vẫn xem được mã đó cho tới khi rời màn hình.

---

### User Story 3 - Người được mời tham gia công ty (Priority: P3)

Người dùng mới đăng nhập bằng Google nhưng chưa thuộc công ty nào. Tại màn hình chọn
workspace, họ bấm "Tham gia công ty", nhập mã nhận được, xác nhận họ tên (nếu tài khoản
mới), và công ty xuất hiện ngay trong danh sách — sau đó vào được tin nhắn và các luồng
khác của công ty.

**Why this priority**: Đóng vòng tròn của luồng mời; không có nó thì mã lời mời không
dùng được ở đâu cả.

**Independent Test**: Tài khoản Google mới (chưa thuộc công ty nào) nhập mã hợp lệ → thấy
công ty trong danh sách workspace và mở được màn hình tin nhắn của công ty đó.

**Acceptance Scenarios**:

1. **Given** người dùng chưa thuộc công ty nào, **When** mở màn hình chọn workspace, **Then** thấy lối vào "Tham gia công ty".
2. **Given** mã hợp lệ, **When** nhập mã và xác nhận, **Then** người dùng tham gia công ty với vai trò theo lời mời và thấy công ty trong danh sách workspace ngay lập tức.
3. **Given** mã sai, hết hạn, đã dùng hết lượt hoặc bị thu hồi, **When** xác nhận, **Then** hiển thị thông báo lỗi rõ ràng bằng tiếng Việt, người dùng nhập lại được.
4. **Given** tài khoản chưa xác nhận họ tên, **When** nhập mã hợp lệ, **Then** người dùng được dẫn qua bước xác nhận họ tên, sau đó hệ thống tự động hoàn tất việc tham gia mà không cần nhập lại mã.
5. **Given** người dùng bấm "Tham gia" hai lần liên tiếp, **Then** chỉ tạo đúng một tư cách thành viên, không trùng lặp.

---

### Edge Cases

- Mã lời mời hết hạn, bị thu hồi hoặc vượt số lượt dùng → thông báo "Lời mời không còn hiệu lực." và cho nhập lại.
- Tài khoản chưa xác nhận họ tên mà nhập mã → chuyển sang xác nhận họ tên, sau đó hệ thống tự hoàn tất việc tham gia (không nhập lại mã).
- Mất mạng giữa chừng khi tạo/nhận lời mời → thông báo lỗi mạng, nút thử lại, không tạo bản ghi trùng.
- Người dùng đã là thành viên của công ty nhập mã của chính công ty đó → thông báo lỗi rõ ràng, không tạo membership trùng.
- Danh sách vai trò trống (công ty chưa cấu hình vai trò) → màn hình mời thông báo không tạo được, không treo.
- Thành viên có quyền mời nhưng thiếu quyền đọc vai trò → màn hình mời thông báo lỗi rõ ràng, không treo.
- Mọi bước chờ mạng (đang tải danh sách vai trò, đang tạo lời mời, đang nhận lời mời) phải có trạng thái đang tải và chặn bấm lặp trong lúc chờ.
- Share sheet không khả dụng trên thiết bị → mã vẫn hiển thị để người dùng sao chép thủ công.
- Người dùng hủy chọn tài khoản Google → ở lại màn hình đăng nhập, không lỗi.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Màn hình đăng nhập MUST đăng nhập bằng tài khoản Google (nút "Đăng nhập bằng Google") và KHÔNG còn nút đăng nhập nội bộ giả lập.
- **FR-002**: App MUST báo lỗi rõ ràng bằng tiếng Việt khi môi trường chưa cấu hình Google (thiếu client ID) thay vì đăng nhập im lặng hoặc treo.
- **FR-003**: Đăng nhập thành công MUST dẫn tới màn hình xác nhận họ tên nếu profile chưa hoàn tất, ngược lại dẫn tới màn hình chọn workspace.
- **FR-004**: Màn hình "Mời thành viên" MUST hiển thị danh sách vai trò của công ty và cho phép chọn đúng một vai trò.
- **FR-005**: Tạo lời mời MUST sinh mã dùng một lần và hiển thị mã đầy đủ kèm nút chia sẻ.
- **FR-006**: Nút chia sẻ MUST mở bảng chia sẻ của hệ điều hành với nội dung gồm mã lời mời và hướng dẫn ngắn.
- **FR-007**: Mục "Mời thành viên" MUST bị ẩn với thành viên không có quyền mời.
- **FR-008**: Người dùng chưa có công ty nào MUST thấy lối vào "Tham gia công ty" trên màn hình chọn workspace và nhập được mã lời mời; người đã có công ty không thấy mục này.
- **FR-009**: Nhận lời mời thành công MUST làm công ty xuất hiện ngay trong danh sách workspace của người dùng (tự làm mới danh sách).
- **FR-010**: Mọi lỗi trong luồng (mã không hợp lệ, hết hạn, đã dùng, bị thu hồi, chưa xác nhận họ tên, tài khoản bị khóa, lỗi mạng) MUST hiển thị thông điệp tiếng Việt rõ ràng, không lộ mã kỹ thuật.
- **FR-011**: Tạo lời mời và nhận lời mời MUST dùng idempotency để bấm lặp không tạo bản ghi trùng.
- **FR-012**: Lời mời MUST tự hết hạn sau đúng 7 ngày kể từ khi tạo; màn hình mời hiển thị hạn này cho người tạo.
- **FR-013**: Đăng xuất MUST xóa phiên và quay về màn hình đăng nhập Google; nút "Đăng xuất" nằm trong tab Workspace và phải có bước xác nhận trước khi xóa phiên.
- **FR-014**: Khi nhập mã hợp lệ nhưng tài khoản chưa có họ tên, hệ thống MUST giữ mã trong luồng và tự động hoàn tất việc tham gia ngay sau khi người dùng xác nhận họ tên, không yêu cầu nhập lại mã.

### Constitutional & Cross-Cutting Requirements *(mandatory)*

- **CR-001**: Ranh giới tenant: lời mời và vai trò chỉ được đọc/ghi trong tenant của membership đang đăng nhập; app không được phép chọn tenant từ dữ liệu client ngoài membership. Phải có test negative cross-tenant (thành viên tenant A không thấy/tạo được lời mời tenant B).
- **CR-002**: Phân quyền: tạo lời mời yêu cầu quyền mời thành viên, danh sách vai trò yêu cầu quyền đọc vai trò; chấp nhận lời mời chỉ cần đăng nhập hợp lệ — vai trò nhận được do backend quyết định theo lời mời, không do client chọn.
- **CR-003**: Lịch sử & idempotency: tạo và nhận lời mời là thao tác retry-safe (idempotency key); mọi thay đổi membership phải ghi audit với actor và thời gian server; client không tự tính thời gian hết hạn hay trạng thái.
- **CR-004**: Validation & quyền riêng tư: mã nhập vào được chuẩn hóa (bỏ khoảng trắng thừa); mã lời mời không được ghi vào log; họ tên xác nhận theo quy tắc hiện có (2-120 ký tự).
- **CR-005**: Vận hành: màn hình đăng nhập sẵn sàng tương tác dưới 3 giây, tạo lời mời phản hồi dưới 5 giây; feature không thêm hạ tầng mới; backend chỉ bổ sung tối thiểu một endpoint quyền của chính tôi (ghi trong Assumptions), ngoài ra không đổi backend.
- **CR-006**: Kiểm thử: mỗi yêu cầu chức năng phải ánh xạ tới unit test (model flows), contract test (3 API đã dùng), integration test (luồng mời → nhận → thấy workspace), accessibility test (3 màn hình) và E2E (luồng tham gia công ty).

### Key Entities *(include if feature involves data)*

- **Lời mời (Invitation)**: mã dùng một lần, vai trò, số lượt dùng tối đa, hạn sử dụng, trạng thái (hoạt động/hết hạn/thu hồi/hết lượt).
- **Tư cách thành viên (Membership)**: quan hệ người dùng ↔ công ty, vai trò, thời điểm tham gia, trạng thái.
- **Định danh Google**: liên kết tài khoản Google với tài khoản người dùng trong hệ thống.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Người dùng hoàn tất đăng nhập bằng Google trong dưới 1 phút, kể cả lần đầu chọn tài khoản.
- **SC-002**: Chủ doanh nghiệp tạo và chia sẻ được một lời mời trong dưới 30 giây.
- **SC-003**: 100% trường hợp nhập mã hợp lệ dẫn tới công ty xuất hiện trong danh sách workspace ngay sau khi xác nhận.
- **SC-004**: 100% lỗi trong luồng hiển thị thông điệp tiếng Việt dễ hiểu, không lộ mã kỹ thuật.
- **SC-005**: Bấm lặp nút tạo/nhận lời mời không tạo bản ghi trùng (0 bản ghi trùng trong kiểm thử tự động).

## Assumptions

- Backend đã có đủ API (tạo/nhận/liệt kê/thu hồi lời mời, danh sách vai trò, đăng nhập Google, danh sách tenant của tôi) — feature này chủ yếu làm phía mobile; nếu phát hiện API thiếu hoặc sai hợp đồng, ghi nhận và báo trước khi implement.
- Phát hiện khi plan (đã báo chủ sản phẩm 2026-09-29): backend thiếu endpoint quyền của chính tôi → bổ sung `GET /v1/tenants/:tenantId/me/permissions` để ẩn mục "Mời thành viên" theo quyền `member.invite` (FR-007). Đây là thay đổi backend duy nhất của feature này.
- Chia sẻ bằng bảng chia sẻ của hệ điều hành (không cần deep link; đường dẫn `/join?token=...` của backend chưa có màn hình xử lý trên mobile).
- Vai trò hiển thị là danh sách lấy từ API của công ty; nếu danh sách rỗng thì ẩn nút tạo lời mời.
- Đăng nhập Google thật cần cấu hình Google Cloud OAuth (client ID) cho app mobile và GOOGLE_CLIENT_ID cho API — chủ sản phẩm xác nhận đã có và sẽ cấu hình; kiểm thử tự động không đòi hỏi tài khoản Google thật (dùng test double ở lớp provider, đúng tinh thần constitution VI).
- Người dùng có kết nối mạng ổn định khi thực hiện các thao tác này.
- Ngoài phạm vi (để giai đoạn sau): màn hình xem danh sách lời mời đã gửi và nút thu hồi lời mời — feature này chỉ làm tạo + chia sẻ mã.
