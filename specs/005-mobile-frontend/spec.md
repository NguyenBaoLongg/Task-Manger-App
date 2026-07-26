# Feature Specification: Mobile Frontend MVP

**Feature Branch**: `005-mobile-frontend`

**Created**: 2026-07-26

**Status**: Draft

**Input**: User description: "Tạo mobile frontend React Native TypeScript với Expo, tích hợp API thật của Module 1-4 cho đăng nhập, tenant/workspace, OKR/KPI, task/action items, chấm công video, lịch ca, nghỉ phép và approval, penalty ledger, booking, dynamic forms, calendar, chat, notification badges và quick actions. Không tạo landing page, mock-only critical path, dữ liệu nghiệp vụ riêng trên mobile hoặc PDF. Giữ tenant isolation, RBAC, audit, idempotency, media privacy và API compatibility."

## Clarifications

### Session 2026-07-26

- Q: Quick action “Đã đến” và “Hủy/Rời lịch” trên notification hoặc lock screen xử lý thế nào? → A: “Đã đến” mở flow xác thực và thu thập ảnh chứng minh khách đã đến trước khi gửi command ARRIVED; backend vẫn authoritative về quyền, consent, media authorization, trạng thái và tính hợp lệ của ảnh. “Hủy/Rời lịch” mở màn hình xác nhận trong app để chọn reason/reschedule theo contract, refresh trạng thái hiện tại rồi mới gửi mutation idempotent.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Đăng nhập và chọn workspace an toàn (Priority: P1)

Nhân sự nội bộ đăng nhập trên ứng dụng mobile, xem các tenant/workspace mà tài khoản
được phép truy cập và chọn một workspace hiện hành. Ứng dụng hiển thị quyền và cơ sở
theo dữ liệu backend, không cho người dùng tự sửa tenant hoặc branch scope trong request.

**Why this priority**: Mọi luồng nghiệp vụ đều phụ thuộc vào danh tính, membership,
tenant context và quyền hiện hành.

**Independent Test**: Đăng nhập bằng tài khoản hợp lệ, chọn workspace được phép, mở một
màn hình nghiệp vụ; xác nhận token/session, tenant context và branch scope được dùng
đúng. Thử tenant hoặc branch ngoài scope và xác nhận backend từ chối mà không tiết lộ
dữ liệu.

**Acceptance Scenarios**:

1. **Given** tài khoản đã xác thực có membership tại nhiều tenant, **When** người dùng
   chọn một workspace, **Then** ứng dụng tải lại quyền, cơ sở và dữ liệu dashboard theo
   workspace đó.
2. **Given** session hết hạn hoặc bị thu hồi, **When** người dùng gọi một luồng cần
   xác thực, **Then** ứng dụng yêu cầu đăng nhập lại và không thực hiện mutation dở dang.
3. **Given** request chứa tenant hoặc branch không thuộc principal hiện hành, **When**
   backend xử lý, **Then** request bị từ chối theo contract và ứng dụng hiển thị lỗi an toàn.

---

### User Story 2 - Xem dashboard, KPI và Việc cần hoàn thành (Priority: P1)

Nhân sự mở tab Dashboard để xem KPI hiện hành, báo cáo trong ngày, tiến độ và badge
Việc cần hoàn thành. Nhân sự có thể mở một action item để deep-link tới đúng form,
booking, video, ảnh hoặc đơn cần xử lý. Quản lý thấy dữ liệu tổng hợp trong phạm vi
tenant/cơ sở được cấp quyền.

**Why this priority**: Đây là màn hình điều phối công việc hằng ngày và là điểm vào của
các luồng KPI, chấm công, booking và approval.

**Independent Test**: Tạo dữ liệu action item từ backend, mở Dashboard ở vai trò nhân
sự và quản lý, kiểm tra badge, lọc scope, trạng thái và deep link; hoàn tất một nguồn
nghiệp vụ rồi refresh để xác nhận item đóng idempotent.

**Acceptance Scenarios**:

1. **Given** nhân sự có KPI chưa đạt, báo cáo chưa nộp hoặc photo debt, **When** mở
   Dashboard, **Then** badge và danh sách hiển thị loại việc, mức ưu tiên, hạn, trạng
   thái và phần còn thiếu từ nguồn backend.
2. **Given** người dùng nhấn một action item, **When** item có source hợp lệ, **Then**
   ứng dụng mở đúng màn hình và giữ tenant/branch context.
3. **Given** quản lý có quyền nhiều cơ sở, **When** chọn bộ lọc cơ sở, **Then** số liệu
   và danh sách chỉ chứa scope đã được backend cho phép.
4. **Given** nguồn nghiệp vụ thay đổi trong lúc màn hình đang mở, **When** nhận refresh
   hoặc realtime update, **Then** badge không tạo bản ghi trùng và trạng thái hiển thị
   được đồng bộ lại.

---

### User Story 3 - Chấm công video, lịch ca, nghỉ phép và approval (Priority: P1)

Nhân sự xem lịch ca và trạng thái ngày làm, mở camera native để quay video check-in,
theo dõi tiến độ upload và gửi lại khi mạng gián đoạn. Nhân sự có thể tạo đơn nghỉ,
đơn đi muộn hoặc yêu cầu đổi ca theo form backend; quản lý xem, duyệt hoặc từ chối
đơn theo workflow hiện hành. Nhân sự xem sổ phạt và trạng thái nộp tiền của mình.

**Why this priority**: Chấm công và approval là nghiệp vụ vận hành hằng ngày, có dữ liệu
nhạy cảm và quy tắc phạt cần được backend quyết định.

**Independent Test**: Mở lịch ca, thực hiện check-in bằng video trên thiết bị có camera,
kiểm tra upload retry và trạng thái chấm công; tạo một đơn nghỉ/đi muộn, duyệt bằng tài
khoản quản lý và xác nhận lịch, penalty ledger, action item và notification cập nhật.

**Acceptance Scenarios**:

1. **Given** nhân sự có ca hiện hành và policy video đã xác nhận, **When** cấp quyền
   camera, quay và gửi video, **Then** ứng dụng hiển thị preview, tiến độ, retry/cancel
   và backend ghi nhận media theo đúng tenant, branch, policy version và session.
2. **Given** video upload bị gián đoạn, **When** người dùng retry, **Then** upload tiếp
   tục hoặc tạo lại intent theo idempotency mà không tạo check-in/penalty trùng.
3. **Given** nhân sự muốn nghỉ cả ngày, nghỉ nửa ngày hoặc nghỉ theo khoảng ngày,
   **When** gửi đơn, **Then** ứng dụng dùng schema/form version hiện hành, hiển thị
   trạng thái chờ duyệt và không tự kết luận đơn đã được duyệt.
4. **Given** quản lý chỉ có quyền tại cơ sở A, **When** mở hoặc quyết định đơn ở cơ sở
   B, **Then** backend từ chối và ứng dụng không hiển thị nội dung ngoài scope.
5. **Given** penalty ledger có khoản phạt, **When** nhân sự xem hoặc gửi chứng từ
   nộp tiền, **Then** chỉ hiển thị dữ liệu được phép và mọi thay đổi trạng thái do
   backend xác nhận, có audit.

---

### User Story 4 - Booking, dynamic forms và lịch khách (Priority: P1)

Nhân sự có quyền xem lịch khách theo cơ sở, tạo hoặc sửa booking hợp lệ bằng form động,
chọn walk-in, cập nhật ARRIVED, consent ảnh khách, photo debt, outcome hoặc reschedule.
Ứng dụng hiển thị conflict, lý do hủy và trạng thái theo API Module 4, không tự bỏ qua
quy tắc chống trùng hoặc quyền cơ sở.

**Why this priority**: Booking là luồng vận hành chính của cơ sở và cần tạo dữ liệu cho
tour, báo cáo, KPI và action item.

**Independent Test**: Mở calendar, tạo booking với FormVersion đã publish, thử mốc
conflict 59/60 phút, gửi form động, ghi ARRIVED và hoàn tất outcome; xác nhận lỗi,
optimistic conflict, retry và scope được xử lý đúng.

**Acceptance Scenarios**:

1. **Given** nhân sự có quyền booking tại cơ sở A, **When** tải calendar, **Then** chỉ
   thấy booking và customer thuộc scope A theo phân trang ổn định.
2. **Given** FormVersion booking được publish, **When** người dùng nhập dữ liệu, **Then**
   ứng dụng render field/validation theo schema version và gửi nguyên payload backend
   yêu cầu.
3. **Given** hai booking cùng nhân sự cách nhau dưới 60 phút, **When** gửi request,
   **Then** backend trả conflict; ứng dụng giữ dữ liệu nháp an toàn để người dùng sửa.
4. **Given** booking đã ARRIVED hoặc có photo debt, **When** người dùng mở action,
   **Then** ứng dụng dẫn tới consent/media/tour tương ứng và không cho hoàn tất khi
   điều kiện backend chưa đạt.
5. **Given** quick action hoặc retry được gửi hai lần, **When** backend xử lý, **Then**
   kết quả idempotent và không nhân đôi transition, outbox, action item hoặc penalty.

---

### User Story 5 - Chat, notification badges và quick actions (Priority: P2)

Nhân sự sử dụng chat nội bộ theo tenant, nhận badge cho approval, photo debt, báo cáo
hoặc việc quá hạn và mở deep link từ notification. Notification cho booking hỗ trợ
quick action “Đã đến” và “Hủy/Rời lịch”; thao tác nhạy cảm vẫn yêu cầu xác thực, quyền,
lý do và command idempotent trên backend.

**Why this priority**: Chat và notification rút ngắn thời gian phản ứng nhưng không được
trở thành nguồn dữ liệu nghiệp vụ thay thế backend.

**Independent Test**: Gửi message trong channel cùng tenant, ngắt rồi kết nối lại,
kiểm tra pagination/unread; nhận notification có badge và thực hiện quick action với
retry, xác nhận trạng thái backend và không có duplicate effect.

**Acceptance Scenarios**:

1. **Given** người dùng có quyền trong chat channel, **When** gửi và nhận message,
   **Then** message hiển thị đúng tenant, pagination và thứ tự server; reconnect không
   nhân đôi message.
2. **Given** có approval/photo debt/action item mới, **When** notification đến,
   **Then** badge cập nhật và nhấn vào mở đúng source.
3. **Given** notification booking còn hiệu lực, **When** người dùng chọn “Đã đến”,
   **Then** ứng dụng xác thực người dùng, yêu cầu gửi ảnh chứng minh khách đã đến,
   gọi command ARRIVED authenticated/idempotent theo media/consent contract và cập nhật
   lại booking từ backend.
4. **Given** người dùng chọn “Hủy/Rời lịch”, **When** command cần reason hoặc booking
   đã đổi trạng thái, **Then** ứng dụng mở màn hình xác nhận, yêu cầu reason/reschedule,
   refresh trạng thái và không gửi mutation mâu thuẫn.

---

### User Story 6 - Trải nghiệm mobile đáng tin cậy và accessible (Priority: P2)

Nhân sự sử dụng ứng dụng trên màn hình nhỏ/lớn, portrait/landscape, light/dark mode,
dynamic text và reduced motion. Các luồng loading, empty, error, offline tạm thời,
permission bị từ chối và session hết hạn đều có trạng thái rõ ràng, không làm mất dữ
liệu nhập hoặc khiến người dùng tưởng mutation đã thành công.

**Why this priority**: Ứng dụng được dùng trong môi trường di chuyển, mạng không ổn định
và có nhiều người dùng với khả năng tiếp cận khác nhau.

**Independent Test**: Chạy các luồng chính trên thiết bị nhỏ và tablet, bật screen
reader/dynamic text/reduced motion, mô phỏng mất mạng và permission denial; xác nhận
touch target, focus order, safe area, lỗi và retry đều usable.

**Acceptance Scenarios**:

1. **Given** API đang loading, rỗng hoặc lỗi, **When** người dùng mở màn hình, **Then**
   ứng dụng hiển thị state có thể hiểu, retry phù hợp và không hiển thị dữ liệu cũ như
   dữ liệu mới.
2. **Given** mất mạng giữa một mutation, **When** mạng trở lại, **Then** app retry theo
   idempotency hoặc yêu cầu người dùng xác nhận lại, không tạo duplicate.
3. **Given** font lớn, screen reader hoặc reduced motion, **When** người dùng thao tác,
   **Then** nội dung không bị che, control có label/role/state và animation không cản
   hoàn tất tác vụ.
4. **Given** device không hỗ trợ quick action hoặc camera capability, **When** người
   dùng mở feature, **Then** app cung cấp fallback rõ ràng thay vì crash.

## Edge Cases

- Người dùng có nhiều tenant, nhiều cơ sở hoặc quyền thay đổi trong lúc app đang mở.
- Access token hết hạn khi đang upload video, gửi form, quyết định approval hoặc thực
  hiện quick action.
- FormVersion, policy, cancellation reason hoặc booking status đổi giữa lúc mở màn hình
  và lúc submit.
- Thiết bị mất mạng, bị OS kill, thiếu dung lượng, camera bị từ chối hoặc upload bị
  gián đoạn.
- Notification đến trễ, đến hai lần, mở từ lock screen hoặc trỏ tới booking đã hủy,
  hết hạn hoặc thuộc branch khác.
- Chat reconnect sau khi gửi message nhưng chưa nhận acknowledgement.
- Backend trả 401, 403, 404, 409, validation error hoặc safe problem code; app không
  được hiển thị PII/secret trong log hay error UI.
- Dynamic text dài, ngôn ngữ dài, màn hình nhỏ, landscape và safe-area/notch làm thay
  đổi layout.
- Module 1-4 không có field hoặc endpoint cần thiết; mobile phải dừng ở contract gap,
  không tự tạo field nghiệp vụ chỉ tồn tại trên mobile.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Ứng dụng MUST xác thực người dùng nội bộ bằng cơ chế auth hiện hành của
  backend và quản lý access/refresh session theo contract; không lưu secret trong source.
- **FR-002**: Ứng dụng MUST cho chọn tenant/workspace từ membership được backend trả về
  và MUST tải lại tenant context, role, permission và branch scope sau khi chọn. Nếu tài khoản
  chỉ có một membership thì hiển thị workspace đó và tiếp tục theo scope backend trả về; nếu có
  nhiều membership thì bắt buộc chọn workspace hiện hành. Chỉ hiển thị
  branch selector khi membership hiện hành có từ hai branch được phép trở lên hoặc backend cấp
  quyền quản lý đa branch; nếu chỉ có một branch thì dùng branch đó mà không yêu cầu chọn lại.
- **FR-003**: Mọi request nghiệp vụ MUST dùng authenticated tenant context và branch scope
  do backend xác định; client MUST NOT tự cấp quyền hoặc dùng tenant ID chưa được xác nhận.
- **FR-004**: Ứng dụng MUST có bottom navigation với các khu vực Dashboard/OKR-KPI,
  Workspace và Chat, có label accessible và route deep-linkable.
- **FR-005**: Dashboard MUST hiển thị KPI hiện hành, trạng thái dữ liệu, phần còn thiếu,
  deadline và badge Việc cần hoàn thành theo quyền người dùng.
- **FR-006**: Action center MUST lấy dữ liệu từ backend và hỗ trợ các bộ lọc rõ ràng:
  employee dùng `state`, `itemType`, `businessDate`; manager dùng `branchId`,
  `departmentId`, `membershipId`, `itemType`, `state`, `from`, `to`. Backend vẫn là
  nơi áp dụng RBAC và branch scope; mobile MUST hỗ trợ phân trang, refresh/realtime
  update và deep-link tới đúng source, không tự kết luận trạng thái nghiệp vụ từ cache.
- **FR-007**: Ứng dụng MUST hiển thị lịch ca, trạng thái check-in, late/leave/approval
  và penalty ledger theo scope, policy version và state backend.
- **FR-008**: Video check-in MUST dùng camera native, kiểm tra permission, hiển thị preview,
  progress, cancel, retry và trạng thái upload; media MUST đi qua consent, signed flow,
  retention và privacy contract của Module 3.
- **FR-009**: Video/media upload MUST chịu được interrupted networking và app lifecycle
  trong giới hạn nền tảng, không block UI thread và không tạo duplicate effect khi retry.
- **FR-010**: Ứng dụng MUST render dynamic forms từ FormTemplate/FormVersion đã publish,
  mirror validation cơ bản ở client nhưng MUST coi server validation là authoritative. Renderer
  MVP chỉ nhận JSON Schema dạng object với `properties`, `required`, `additionalProperties`,
  `title`, `description`, các field `string|number|integer|boolean|array`, cùng `enum`,
  `format`, `pattern`, `minLength`, `maxLength`, `minimum`, `maximum`, `items`, `minItems` và
  `maxItems`; `uiSchema` chỉ nhận label, description, order và widget metadata. Keyword hoặc
  metadata ngoài subset này phải hiện compatibility error và chặn submit, không bị bỏ qua.
- **FR-011**: Ứng dụng MUST hỗ trợ tạo/xem/sửa booking, calendar, walk-in, ARRIVED,
  consent/photo debt, outcome và reschedule bằng các contract Module 4 hiện hành.
- **FR-012**: Booking UI MUST hiển thị conflict, optimistic concurrency, stale version,
  permission denial và validation error mà không âm thầm bỏ qua hoặc sửa dữ liệu.
- **FR-013**: Approval UI MUST tạo, xem, bổ sung, approve/reject hoặc retry request theo
  workflow contract; quyết định MUST có actor, reason, idempotency và audit ở backend.
- **FR-014**: Penalty ledger UI MUST chỉ hiển thị và gửi thao tác mà role hiện hành được
  phép; mobile không tự tính, sửa, waive, confirm hoặc refund khoản phạt.
- **FR-015**: Chat MUST là tenant-scoped, hỗ trợ pagination, reconnect, unread count,
  optimistic state reconciliation và redaction an toàn; chat không là system of record.
- **FR-016**: Notification MUST cập nhật badge cho action item, approval, photo debt,
  KPI và booking event; refresh/retry không tạo badge hoặc notification trùng.
- **FR-017**: Quick action “Đã đến” MUST xác thực người dùng, thu thập ảnh chứng minh
  khách đã đến và gửi command ARRIVED authenticated/idempotent theo media/consent
  contract; “Hủy/Rời lịch” MUST mở flow xác nhận và thu thập reason/reschedule khi
  contract yêu cầu.
- **FR-018**: Ứng dụng MUST hỗ trợ loading, empty, error, unauthorized, forbidden,
  conflict, offline tạm thời, retry và session-expired state cho mọi critical path.
- **FR-019**: App MUST bảo toàn draft chưa gửi khi phù hợp, nhưng không được coi local
  storage/cache là nguồn authoritative cho tenant, permission, booking, attendance,
  approval, chat, penalty hoặc KPI.
- **FR-020**: Mọi deep link, notification route và quick action MUST re-check current
  auth, tenant, branch, permission, entity state và expiry trước khi hiển thị hoặc mutate.
- **FR-021**: Navigation MUST hỗ trợ back behavior, safe areas, trạng thái selected,
  disabled, focus order, semantic labels và touch target tối thiểu theo nền tảng.
- **FR-022**: UI MUST hỗ trợ light/dark theme, dynamic text, reduced motion, portrait,
  landscape, màn hình nhỏ/lớn và tablet mà không che nội dung hoặc control.
- **FR-023**: App MUST không ghi PII, token, signed URL, object key hoặc credential vào
  log; media preview/cache phải tuân thủ privacy và lifecycle của backend.
- **FR-024**: App MUST dùng các API/contract đã publish của Module 1-4 và MUST dừng triển
  khai khi phát hiện contract gap thay vì tạo mock-only critical path hoặc field riêng.
- **FR-025**: Critical paths MUST có test cho navigation, API client, auth refresh,
  tenant/branch denial, RBAC, idempotency/retry, dynamic form, media, notification,
  quick action, accessibility và API compatibility.
- **FR-026**: MVP MUST không triển khai OKR hierarchy nâng cao, weekly OKR check-in,
  PDF, customer self-booking, payroll/payment gateway, landing page hoặc business data
  chỉ tồn tại trên mobile.

### Operational Definitions

- **Critical path** là login/workspace, Dashboard/action center, video check-in, leave/approval,
  booking/ARRIVED, cancellation/reschedule, chat send và notification quick action.
- **Near realtime** nghĩa là action-item/badge/realtime event được reconcile hoặc trigger refresh
  trong tối đa 10 giây khi transport còn hoạt động; server state vẫn là authority sau reconnect.
- **Safe error** là trạng thái có problem `code` và `correlationId`, không hiển thị secret, PII,
  signed URL hoặc raw provider detail, không tự thực hiện mutation và luôn có đường refresh/retry
  hoặc re-auth phù hợp.
- **Supported capability** là capability đã được kiểm thử trên Expo development build của iOS
  hoặc Android mục tiêu; nếu profile không hỗ trợ thì dùng validated in-app fallback và không
  coi capability đó là điều kiện của business transition.

### Constitutional & Cross-Cutting Requirements *(mandatory)*

- **CR-001**: Mọi screen, cache key, request, deep link, notification và websocket
  subscription MUST giữ tenant context; cross-tenant/ngoài branch scope phải bị backend
  từ chối và có test negative.
- **CR-002**: UI MUST phản ánh RBAC/membership/branch scope từ backend; không hard-code
  administrator, permission hoặc tenant selection authority trong app.
- **CR-003**: Mọi mutation mobile có retry hoặc quick action MUST truyền idempotency
  boundary phù hợp; app phải reconcile server state và không tự ghi lịch sử/audit giả.
- **CR-004**: Video, ảnh khách, token, consent evidence và PII MUST dùng least-privilege,
  signed/authorized flow, redacted logs, retention và không bị lưu authoritative ở local.
- **CR-005**: App MUST có telemetry an toàn cho request failure, auth refresh, upload,
  reconnect, notification action và latency; không làm lộ secret/PII.
- **CR-006**: Mỗi FR/CR MUST được truy vết tới unit, contract, integration, accessibility,
  E2E hoặc device verification phù hợp trước khi đánh dấu hoàn thành.

### Key Entities *(include if feature involves data)*

- **Authenticated Session**: phiên đăng nhập, token lifecycle, device context và logout/
  revocation state do backend quản lý.
- **Tenant Workspace Context**: tenant hiện hành, membership, role, permission và branch
  scope được backend cấp.
- **Dashboard Snapshot**: dữ liệu KPI/action item được đọc theo tenant scope, không phải
  nguồn ghi nghiệp vụ mới.
- **Mobile Form Session**: FormTemplate/FormVersion, draft validation và submission
  correlation cho form động.
- **Attendance Media Session**: camera permission, video upload intent, progress, retry,
  consent/policy binding và server result.
- **Booking Calendar View**: trang dữ liệu booking/customer/service/status theo scope,
  cursor và filter server-authoritative.
- **Notification/Quick Action Command**: notification event, unread state, deep link,
  action payload, idempotency key và command result.
- **Chat Conversation**: tenant-scoped channel, paginated messages, cursor, unread count
  và realtime connection state.
- **Mobile Accessibility State**: focus/label/role, dynamic text, theme, reduced-motion
  và device orientation state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ít nhất 19/20 lượt chạy seeded hợp lệ trên mỗi device profile hỗ trợ phải
  hoàn tất đăng nhập và chọn workspace trong dưới 60 giây ở lần thử đầu tiên, không cần
  nhập lại tenant/branch thủ công.
- **SC-002**: 100% request cross-tenant hoặc ngoài branch scope trong bộ kiểm thử mobile
  bị backend từ chối và không hiển thị PII, booking, media, KPI, chat hoặc approval.
- **SC-003**: Ít nhất 19/20 lượt chạy seeded sau khi session hợp lệ phải mở được Dashboard
  và Việc cần hoàn thành trong dưới 3 giây trên mỗi device profile hỗ trợ.
- **SC-004**: 100% dynamic form được render theo đúng FormVersion và mọi field server
  validation error được hiển thị tại field hoặc form summary phù hợp.
- **SC-005**: 100% video check-in mẫu có permission, preview, progress, interrupted
  upload retry và kết quả server; retry không tạo duplicate check-in/media/penalty.
- **SC-006**: 100% booking boundary, ARRIVED, consent/photo debt, outcome, reschedule,
  approval và quick action trong bộ test giữ đúng current scope, state và idempotency.
- **SC-007**: 100% notification/action item mẫu deep-link đúng source; duplicate delivery
  hoặc reconnect không làm tăng badge, message hoặc business transition ngoài ý muốn.
- **SC-008**: 100% critical screens đạt touch target, accessible label/role/focus order,
  safe-area và không che nội dung ở phone nhỏ, phone lớn và tablet portrait/landscape.
- **SC-009**: Tối thiểu 95% lượt thử recovery thành công trong các critical path recoverable
  khi API trả lỗi, session hết hạn, permission bị từ chối hoặc mạng bị ngắt giữa thao tác;
  denominator là toàn bộ scenario seeded có một injected failure tại recovery point được
  hỗ trợ, tối thiểu 20 lượt trên ma trận nền tảng và network profile của release.
- **SC-010**: Mobile build và E2E smoke tích hợp API thật của Module 1-4 pass mà không
  cần mock-only critical path, production credential hoặc dữ liệu nghiệp vụ riêng trên app.

## Assumptions

- Backend Module 1-4, shared schemas, OpenAPI/domain events và permission contracts đã ổn
  định; nếu thiếu contract, phải tạo clarification/remediation trước khi implement mobile.
- Người dùng mobile là nhân sự nội bộ đã xác thực; customer self-booking không thuộc MVP.
- KPI hiện hành và action center được triển khai; OKR hierarchy nâng cao và weekly check-in
  nằm ngoài MVP theo PRODUCT_REQUIREMENTS_MVP.md.
- Native client baseline của repository là React Native với TypeScript và Expo; lựa chọn
  này không thay đổi authoritative backend data model.
- Local read cache/draft có thể dùng để cải thiện trải nghiệm, nhưng mọi mutation, quyền,
  trạng thái và dữ liệu nghiệp vụ phải xác nhận lại với backend.
- Push provider, camera và object storage dùng adapter/test double trong local/test; không
  yêu cầu credential FCM/APNs/S3 production để chạy acceptance local.
- Quick action trên lock screen có thể khác nhau giữa iOS/Android; khi platform không hỗ
  trợ, app cung cấp deep-link hoặc màn hình fallback có xác thực.
- Tiếng Việt là ngôn ngữ hiển thị chính của MVP; text dài, dynamic type và trạng thái lỗi
  phải được kiểm thử như dữ liệu thật.
