# Feature Specification: KPI hằng ngày và việc cần hoàn thành

**Feature Branch**: `002-okr-kpi-engine`

**Created**: 2026-07-19

**Status**: Draft

**Input**: Xây dựng Module 2 của Adsup trên nền tảng đa tenant đã hoàn thành: KPI hằng ngày lấy
dữ liệu từ biểu mẫu động và nguồn nghiệp vụ, policy có phiên bản theo tenant/cơ sở, đánh giá sau
20:00, phạt mặc định 100.000 VND, nợ ảnh có cấu hình và trung tâm “Việc cần hoàn thành”.

## Clarifications

### Session 2026-07-19

- **Q**: Nếu một nhân viên làm tại nhiều cơ sở trong cùng ngày thì cơ sở nào quyết định policy KPI
  và mức phạt duy nhất? **A**: MVP hiện tại chỉ cho mỗi nhân viên làm tại một cơ sở. Policy override
  của cơ sở duy nhất đó được áp dụng; nếu không có override thì dùng policy mặc định tenant.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cấu hình KPI và policy nhiều cơ sở (Priority: P1)

Tenant Owner định nghĩa KPI doanh số, số nhiệm vụ hoàn thành và tỷ lệ đi làm đúng giờ; đặt target
cho toàn doanh nghiệp, một nhóm nhân viên hoặc riêng từng nhân viên; đồng thời cấu hình khung báo
cáo, giờ đánh giá và mức phạt cho toàn tenant hoặc nhiều cơ sở được chọn.

**Why this priority**: Mọi báo cáo, đánh giá và khoản phạt đều phải tham chiếu đúng phiên bản cấu
hình có hiệu lực. Nếu nền tảng policy sai thì toàn bộ kết quả lịch sử không đáng tin cậy.

**Independent Test**: Tạo policy mặc định tenant, override cho hai cơ sở và target riêng cho một
nhân viên; thay đổi cấu hình ở ngày kế tiếp rồi chứng minh mỗi ngày dùng đúng phiên bản có hiệu lực.

**Acceptance Scenarios**:

1. **Given** Tenant Owner có quyền quản lý KPI, **When** áp dụng một cấu hình hàng loạt cho nhiều cơ
   sở đã chọn, **Then** hệ thống tạo phiên bản mới, lưu chính xác danh sách cơ sở bị ảnh hưởng và
   không thay đổi kết quả của ngày đã đóng.
2. **Given** một cơ sở có policy override đang hiệu lực, **When** hệ thống xác định khung báo cáo và
   mức phạt của nhân viên tại cơ sở đó, **Then** override cơ sở được ưu tiên hơn policy tenant.
3. **Given** quản lý sửa target riêng của nhân viên, **When** lưu thay đổi, **Then** hệ thống giữ
   phiên bản trước/sau, người sửa, lý do, thời điểm và ngày bắt đầu hiệu lực.
4. **Given** một ID cơ sở hoặc nhân viên thuộc tenant khác, **When** được gửi trong cấu hình hàng
   loạt, **Then** toàn bộ thao tác bị từ chối mà không ghi một phần.

---

### User Story 2 - Nộp báo cáo và biết chính xác phần còn thiếu (Priority: P1)

Nhân viên nộp/cập nhật báo cáo KPI hằng ngày bằng biểu mẫu động trong khung 18:00–20:00 và xem
ngay từng KPI đã đạt bao nhiêu, còn thiếu bao nhiêu, nguồn dữ liệu mới nhất và việc nào cần hoàn tất.

**Why this priority**: Đây là luồng sử dụng hằng ngày và trực tiếp đáp ứng yêu cầu giao diện nhắc
nhân viên về báo cáo/KPI còn thiếu.

**Independent Test**: Nhân viên có ba KPI bắt buộc nộp hai lần trong khung giờ; hệ thống giữ hai
revision, hiển thị snapshot mới nhất và action item duy nhất với số còn thiếu chính xác.

**Acceptance Scenarios**:

1. **Given** báo cáo hôm nay đang mở, **When** nhân viên nộp form hợp lệ lúc 18:30, **Then** hệ thống
   ghi revision, cập nhật snapshot KPI và action-item feed gần realtime.
2. **Given** nhân viên cập nhật lại trước 20:00, **When** lưu lần hai, **Then** revision cũ không bị
   ghi đè và snapshot đánh giá hiện hành dùng revision mới nhất đủ điều kiện.
3. **Given** KPI doanh số target 10.000.000 và thực tế 7.500.000, **When** mở “Việc cần hoàn thành”,
   **Then** nhân viên thấy còn thiếu 2.500.000 VND, hạn 20:00, trạng thái nguồn và deep-link đúng form.
4. **Given** một KPI được đo tự động từ nguồn đã cấu hình, **When** client gửi giá trị tiến độ tự
   nhập, **Then** hệ thống bỏ qua/từ chối giá trị không có thẩm quyền và chỉ dùng dữ liệu nguồn.
5. **Given** nhân viên xem dữ liệu của người khác hoặc tenant khác, **When** gọi API cá nhân, **Then**
   hệ thống từ chối an toàn và không tiết lộ target, số liệu hay trạng thái action item.

---

### User Story 3 - Đóng ngày và tạo đúng một khoản phạt KPI (Priority: P1)

Sau giờ đóng, worker đánh giá tất cả KPI bắt buộc của từng nhân viên thuộc diện báo cáo. Không nộp,
nộp muộn hoặc thiếu bất kỳ KPI bắt buộc nào làm ngày đó không đạt và chỉ tạo một khoản phạt KPI.

**Why this priority**: Quy tắc tiền phạt tác động trực tiếp tới nhân viên, cần tái hiện được và không
được nhân đôi khi job retry.

**Independent Test**: Chạy đồng thời và chạy lại job đánh giá của cùng tenant/ngày nhiều lần; chứng
minh mỗi nhân viên không đạt có đúng một kết quả và một khoản phạt tham chiếu đúng policy version.

**Acceptance Scenarios**:

1. **Given** nhân viên thiếu một trong ba KPI bắt buộc lúc đóng ngày, **When** job đánh giá chạy,
   **Then** kết quả là `FAILED` và tạo một khoản phạt 100.000 VND theo policy đang hiệu lực.
2. **Given** nhân viên thiếu cả ba KPI, **When** job chạy, **Then** vẫn chỉ có một khoản phạt nhưng
   chi tiết lưu đủ ba target chưa đạt, actual, đơn vị và nguồn.
3. **Given** cùng job bị retry hoặc hai worker nhận cùng lịch chạy, **When** cả hai xử lý, **Then**
   khóa nghiệp vụ ngăn kết quả, penalty hoặc thông báo bị tạo trùng.
4. **Given** policy thay đổi sau khi ngày đã đóng, **When** xem lại kết quả cũ, **Then** số tiền và
   phép tính vẫn dùng policy version cũ; sửa sai phải tạo adjustment mới có lý do và audit.
5. **Given** nhân viên được miễn theo policy server-side cho ngày đó, **When** job chạy, **Then** kết
   quả ghi rõ căn cứ miễn và không tự suy ra miễn từ dữ liệu client.

---

### User Story 4 - Quản lý theo dõi thiếu hụt và điều chỉnh có kiểm soát (Priority: P2)

Manager/Tenant Owner xem tổng hợp theo phạm vi được phép, lọc theo cơ sở, phòng ban, nhân viên,
trạng thái và ngày; mở chi tiết nguồn, chạy lại đánh giá hoặc tạo điều chỉnh có lý do.

**Why this priority**: Quản lý cần giải thích được kết quả và xử lý sai lệch mà không phá lịch sử.

**Independent Test**: Manager chỉ có quyền một cơ sở xem dashboard, mở chi tiết một nhân viên,
không xem được cơ sở khác và tạo adjustment được audit cho một kết quả đã đóng.

**Acceptance Scenarios**:

1. **Given** Manager có branch scope tại cơ sở A, **When** lọc dashboard tenant, **Then** chỉ số và
   nhân viên của cơ sở A xuất hiện; dữ liệu cơ sở B không được suy ra từ tổng hay chi tiết.
2. **Given** một kết quả đã đóng, **When** người có quyền tạo adjustment với lý do, **Then** hệ thống
   giữ nguyên kết quả gốc, ghi giao dịch bù trừ và cập nhật số còn phải nộp theo lịch sử.
3. **Given** người không có permission chạy lại evaluation, **When** gửi lệnh, **Then** hệ thống trả
   lỗi phân quyền ổn định và không tạo job run.

---

### User Story 5 - Hoàn tất ảnh minh chứng khi policy yêu cầu (Priority: P2)

Đối với KPI/form được Tenant Owner bật yêu cầu ảnh, hệ thống tính số ảnh cần có, ghi nợ ảnh rõ ràng,
nhắc sau khi báo cáo được nộp và chỉ chốt phạt ảnh theo phiên bản policy đã cấu hình.

**Why this priority**: PRD yêu cầu hỗ trợ nợ ảnh/phạt ảnh theo cấu hình nhưng cấm tự động kết luận
ảnh trùng trong MVP.

**Independent Test**: Bật evidence policy cho một loại báo cáo, nộp báo cáo thiếu ảnh, bổ sung trong
5 phút ở một lần và không bổ sung ở lần khác; chứng minh state, reminder và penalty đều idempotent.

**Acceptance Scenarios**:

1. **Given** policy yêu cầu ảnh cho hai KPI thực tế và form có ghi doanh thu, **When** báo cáo được
   nộp thiếu ảnh, **Then** required count bằng 3, báo cáo vào `WAITING_PHOTOS` và action item nêu số
   ảnh còn thiếu.
2. **Given** nhân viên bổ sung đủ ảnh trong thời gian ân hạn, **When** media hợp lệ được liên kết,
   **Then** nợ ảnh đóng idempotently và không tạo phạt ảnh.
3. **Given** vẫn thiếu ảnh sau reminder và thời hạn policy, **When** job finalize chạy lại nhiều lần,
   **Then** chỉ có một penalty outcome theo policy version.
4. **Given** hai ảnh giống nhau, **When** nộp trong MVP, **Then** hệ thống không tự kết luận gian lận
   bằng perceptual hash; chỉ giữ metadata/điểm mở rộng cho xử lý tương lai.

### Edge Cases

- Giờ mở/đóng/đánh giá được diễn giải theo múi giờ tenant; ngày nghiệp vụ và instant UTC phải được
  lưu rõ khi đổi DST hoặc policy bắt đầu giữa các ngày.
- Trong phạm vi Module 2 MVP, mỗi nhân viên chỉ có một cơ sở làm việc hiện hành. Nếu dữ liệu bất ngờ
  có nhiều cơ sở hiện hành, evaluation MUST dừng an toàn để quản lý sửa dữ liệu, không tự chọn policy
  hoặc tạo tiền phạt theo phỏng đoán.
- Policy override hết hiệu lực đúng lúc đánh giá phải được chọn theo ngày nghiệp vụ/snapshot đã khóa,
  không theo thời điểm job retry.
- Form version bị retire sau khi nhân viên nộp không làm mất dữ liệu nguồn đã snapshot.
- Giá trị tiền tệ, tỷ lệ và số đếm phải dùng quy tắc làm tròn/đơn vị đã công bố; không dùng số thực
  nhị phân để lưu tiền.
- Source submission bị gửi lại cùng khóa nhưng payload khác phải trả conflict; payload giống phải
  trả đúng kết quả cũ.
- Media upload hoàn thành sau thời hạn chỉ được đóng photo debt nếu policy cho phép; client không tự
  đổi deadline hoặc state.
- Job thất bại một phần phải tiếp tục được từ checkpoint an toàn và không để evaluation ở trạng thái
  vừa đóng vừa chưa đóng.
- Xóa/suspend membership không được xóa KPI, report revision, evaluation, penalty hoặc audit lịch sử.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST quản lý KPI definition tenant-scoped với mã ổn định, tên, mô tả, loại
  giá trị (`MONEY`, `COUNT`, `PERCENTAGE`), đơn vị, chiều so sánh, nguồn đo và trạng thái.
- **FR-002**: Hệ thống MUST hỗ trợ tối thiểu KPI doanh số, số nhiệm vụ hoàn thành và tỷ lệ đi làm
  đúng giờ; seed tenant mẫu MUST tạo ba KPI này idempotently.
- **FR-003**: KPI target MUST có phiên bản, khoảng hiệu lực và phạm vi tenant, cơ sở, phòng ban,
  nhóm membership hoặc membership riêng; target cụ thể hợp lệ hơn MUST thắng target mặc định.
- **FR-004**: Người có permission MUST có thể sửa target riêng của nhân viên mà không cần chu kỳ cố
  định; thay đổi MUST giữ before/after, người sửa, lý do và thời điểm hiệu lực.
- **FR-005**: Hệ thống MUST quản lý Daily KPI Policy có phiên bản gồm giờ mở, giờ đóng, giờ đánh giá,
  mức phạt không đạt, phạm vi KPI/nhân viên, exemption rule và tùy chọn evidence/photo-debt.
- **FR-006**: Tenant Owner MUST có thể áp dụng một policy cho toàn tenant, một cơ sở hoặc nhiều cơ
  sở cùng tenant trong một thao tác nguyên tử; request MUST xác nhận rõ danh sách cơ sở bị ảnh hưởng.
- **FR-007**: Khi cùng hiệu lực, branch override MUST được ưu tiên hơn policy tenant; policy version
  của cơ sở làm việc duy nhất được ưu tiên hơn policy tenant và MUST được snapshot vào kết quả ngày
  cùng penalty. Nhiều cơ sở hiện hành cho một nhân viên MUST là lỗi dữ liệu chặn evaluation.
- **FR-008**: Hệ thống MUST mở báo cáo mặc định 18:00, đóng 20:00 và đánh giá sau 20:00 theo múi giờ
  tenant; mọi mốc MUST cấu hình/version được mà không sửa ngược ngày đã đóng.
- **FR-009**: Báo cáo KPI hằng ngày MUST tham chiếu form template/version đã phát hành, membership,
  cơ sở và ngày nghiệp vụ; nhân viên chỉ nộp cho chính mình trừ permission quản lý rõ ràng.
- **FR-010**: Mỗi lần lưu báo cáo trong khung cho phép MUST tạo revision bất biến; snapshot hiện hành
  MUST chỉ ra revision và source record đã dùng.
- **FR-011**: Tiến độ KPI tự động MUST được tính từ form submission hoặc nguồn nghiệp vụ có thẩm
  quyền bằng mapping có phiên bản; client không được nhập đè actual của mapping tự động.
- **FR-012**: Mỗi calculation MUST lưu KPI target version, công thức/phiên bản mapping, actual đã
  chuẩn hóa, đơn vị, source type/source ID và thời điểm tính để tái hiện lịch sử.
- **FR-013**: Trước giờ đóng, hệ thống MUST cung cấp progress hiện hành gồm target, actual, remaining,
  trạng thái dữ liệu và hạn cho từng KPI áp dụng.
- **FR-014**: Sau giờ đóng, evaluation MUST dùng snapshot cuối đủ điều kiện và đánh dấu `PASSED` chỉ
  khi tất cả KPI bắt buộc đều đạt; thiếu một KPI, không nộp hoặc nộp muộn MUST là `FAILED`.
- **FR-015**: Exemption MUST chỉ áp dụng từ rule/dữ liệu server-side đã cấu hình; kết quả MUST lưu
  căn cứ miễn và không tin cờ miễn do client gửi.
- **FR-016**: Mỗi membership không đạt MUST nhận tối đa một penalty KPI/ngày/policy scope, mặc định
  100.000 VND; penalty MUST lưu ngày, amount, currency, policy version và toàn bộ failed KPI detail.
- **FR-017**: Evaluation, penalty, reminder, photo-debt finalization và manual rerun MUST idempotent,
  retry-safe và an toàn khi nhiều worker xử lý đồng thời.
- **FR-018**: Kết quả/penalty đã đóng MUST không bị cập nhật tại chỗ; sửa sai MUST tạo adjustment có
  số tiền trước/sau, lý do, actor, correlation ID và audit.
- **FR-019**: Khi evidence policy được bật, required photo count MUST bằng số KPI thực tế được cấu
  hình cần ảnh cộng một nếu form có doanh thu; nếu không bật thì không tạo photo debt/phạt ảnh.
- **FR-020**: Thiếu evidence MUST tạo `WAITING_PHOTOS`, deadline và reminder idempotent; bổ sung đủ
  media hợp lệ MUST đóng debt, quá hạn MUST finalize theo đúng policy version.
- **FR-021**: MVP MUST không dùng perceptual hash để tự động kết luận ảnh trùng/gian lận; data model
  MAY giữ fingerprint status/version nullable và worker interface tắt để mở rộng sau này.
- **FR-022**: Hệ thống MUST tạo action item KPI/report/photo-debt duy nhất theo tenant, owner, loại,
  source và ngày; source hoàn tất MUST đóng item idempotently nhưng giữ history.
- **FR-023**: Action item cá nhân MUST trả target, actual, remaining, unit, deadline, source freshness,
  state và deep-link; badge MUST cập nhật gần realtime khi source thay đổi.
- **FR-024**: Dashboard quản lý MUST hỗ trợ phạm vi tenant/một/nhiều cơ sở được phép và lọc theo cơ
  sở, phòng ban, nhân viên, loại việc, trạng thái, ngày; tổng không được rò dữ liệu ngoài scope.
- **FR-025**: Hệ thống MUST có cursor pagination cho lịch sử report revision, calculation, evaluation,
  adjustment và action-item transition.
- **FR-026**: Mọi mutation công khai và job retry MUST có fingerprinted idempotency scope phù hợp;
  cùng key/payload trả replay, khác payload trả conflict an toàn.
- **FR-027**: Mọi thay đổi policy, target, mapping, report revision, evaluation, penalty, evidence debt,
  adjustment và action-item state MUST có audit reason cùng before/after đã làm sạch.
- **FR-028**: Hệ thống MUST phát sự kiện domain/outbox sau khi business transaction commit để worker,
  push và realtime có thể retry mà không mất hoặc nhân đôi hiệu ứng.
- **FR-029**: Hệ thống MUST giữ dữ liệu lịch sử khi KPI/policy/membership bị retire, suspend hoặc rời
  tenant; truy vấn hiện hành không được làm thay đổi snapshot đã đóng.
- **FR-030**: Cây OKR Company → Department → Individual và weekly OKR check-in MUST không được triển
  khai trong MVP; chỉ được thêm sau khi PRD thay đổi và có feature spec riêng.

### Constitutional & Cross-Cutting Requirements *(mandatory)*

- **CR-001**: Mọi entity, query, unique key, outbox event và job cursor của Module 2 MUST tenant-scoped;
  test MUST chứng minh từ chối ID tenant khác ở policy, target, report, source, media và action item.
- **CR-002**: Permission/scope MUST được nêu cho quản lý KPI, chỉnh target, cấu hình policy, xem báo
  cáo, chạy lại evaluation và adjustment; assignment công việc không tự cấp quyền.
- **CR-003**: Policy/target/mapping/report/evaluation/penalty/action item MUST có lịch sử bất biến,
  audit reason, idempotency và transaction/concurrency boundary rõ.
- **CR-004**: Form payload, doanh thu và evidence metadata MUST được tối thiểu hóa, tenant-authorized,
  không ghi vào log; media tiếp tục dùng signed URL/retention của nền tảng.
- **CR-005**: Module MUST phục vụ capacity MVP trong PRD, xử lý đánh giá theo lô có checkpoint, không
  hard-code giới hạn tenant/cơ sở/người dùng và phát metrics không chứa tenant/member ID làm label.
- **CR-006**: Mỗi FR/CR MUST ánh xạ tới unit, contract, integration, tenant-isolation, migration,
  worker retry/concurrency hoặc load verification; local test không cần cloud credential thật.

### Key Entities

- **KPI Definition**: Định nghĩa chỉ số, loại giá trị, đơn vị, chiều so sánh và nguồn đo trong tenant.
- **KPI Target Version**: Target có hiệu lực và phạm vi áp dụng, giữ lịch sử thay đổi.
- **Daily KPI Policy Version**: Khung báo cáo/đánh giá, penalty và evidence rule theo tenant/cơ sở.
- **KPI Source Mapping Version**: Ánh xạ trường form hoặc nguồn nghiệp vụ tới actual chuẩn hóa.
- **Daily KPI Report / Revision**: Báo cáo ngày và các lần lưu bất biến của nhân viên.
- **KPI Calculation Event**: Kết quả tính một KPI từ target/mapping/source version cụ thể.
- **Daily KPI Evaluation**: Snapshot đóng ngày gồm trạng thái và các KPI đạt/chưa đạt/được miễn.
- **Penalty Outcome / Adjustment**: Khoản phạt bất biến và các giao dịch điều chỉnh lịch sử.
- **Evidence Debt**: Required/received count, state, deadline, reminder/finalization của ảnh bắt buộc.
- **Action Item / Transition**: Việc cần hoàn thành có source key duy nhất và lịch sử state/deep-link.
- **Job Run / Outbox Event**: Bản ghi chạy nền, checkpoint và sự kiện retry-safe sau commit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% thay đổi policy/target được tái hiện bằng version, actor, reason, effective time và
  before/after; không có ngày đã đóng đổi kết quả khi cấu hình mới được tạo.
- **SC-002**: 100% kịch bản tenant/branch ID ngoại phạm vi trong test bị từ chối mà không rò target,
  actual, tổng dashboard, source metadata hoặc action item.
- **SC-003**: Với cùng tenant/member/business date/policy scope, 100 lần retry/concurrent evaluation
  vẫn tạo đúng một evaluation và tối đa một penalty outcome.
- **SC-004**: Trong test clock, report revision hợp lệ trước 20:00 được dùng, report lúc/sau 20:00
  không làm ngày đạt, và toàn bộ quyết định khớp múi giờ/policy version.
- **SC-005**: 100% KPI hiện hành trả remaining chính xác cho money/count/percentage và chỉ `PASSED`
  khi mọi KPI bắt buộc đạt.
- **SC-006**: Action-item feed tạo đúng một item cho mỗi source key, đóng idempotently và phản ánh
  thay đổi vào badge/realtime event trong vòng 5 giây ở môi trường kiểm thử.
- **SC-007**: Evidence reminder/finalization retry 100 lần không tạo trùng reminder, debt transition
  hay photo penalty; perceptual hash không đưa ra fraud decision trong MVP.
- **SC-008**: 100% API công bố có runtime contract test cho success, validation, authentication,
  authorization, idempotency/conflict và safe error; migration, unit, integration, worker và build pass.
- **SC-009**: Worker có thể xử lý profile mục tiêu 10.000 membership/ngày theo batch/checkpoint và
  API đọc progress/action item đạt p95 dưới 500 ms ở load profile chuẩn trước production.

## Assumptions

- Module 1 đã ổn định các schema/API tenant, membership, assignment, RBAC, dynamic form, media,
  idempotency, audit, notification và realtime cần dùng.
- “Không có chu kỳ cố định” nghĩa target/policy dùng khoảng hiệu lực tùy ý; MVP không tạo quý/tuần
  bắt buộc và không triển khai objective alignment graph.
- Module 2 MVP coi mỗi nhân viên có đúng một cơ sở làm việc hiện hành. Nền tảng Module 1 giữ mô
  hình assignment có khoảng hiệu lực để lưu lịch sử chuyển cơ sở, nhưng không cho các khoảng hiệu lực chồng lấn.
- KPI tỷ lệ đúng giờ có source adapter nhưng dữ liệu chính thức chỉ xuất hiện khi Module 3 hoàn tất;
  Module 2 kiểm thử bằng source event/test double và không tự sở hữu attendance.
- KPI nhiệm vụ hoàn thành có thể lấy từ trường form động trong MVP; không giả định có một task
  management subsystem riêng.
- Photo-debt rule chỉ hoạt động khi policy/template bật rõ. Mức phạt ảnh và grace period là trường
  policy có phiên bản; mặc định grace period là 5 phút, không tự suy ra mức tiền ngoài cấu hình.
- Module 2 tạo action item cho KPI/report/evidence; booking, attendance và approval sẽ đăng cùng
  feed qua source contract ở các module sau.
- Metadata KPI/audit tuân retention 5 năm; binary evidence tiếp tục theo retention media hiện hành.
