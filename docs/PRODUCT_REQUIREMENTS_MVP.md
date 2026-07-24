# Adsup — Yêu cầu sản phẩm MVP

Tài liệu này là nguồn sự thật sản phẩm cho giai đoạn MVP, được tổng hợp từ yêu cầu người dùng ngày 18/07/2026 và xác nhận bổ sung ngày 19/07/2026. Quy định thời gian làm việc của tenant mẫu có hiệu lực từ ngày 10/07/2026.

## 1. Định vị sản phẩm

- Tên sản phẩm: **Adsup**.
- Ngành ưu tiên của MVP: clinic/thẩm mỹ.
- Mô hình: Mobile SaaS đa tenant phục vụ vận hành nhân sự, lịch khách, KPI, chấm công, quy trình duyệt và chat nội bộ.
- Một tài khoản có thể tạo tenant mới và tham gia nhiều tenant bằng mã hoặc liên kết mời.
- Tenant có nhiều cơ sở. Các cơ sở có thể cung cấp loại dịch vụ giống nhau nhưng lịch khách và nhân sự phải được quản lý riêng theo cơ sở.

### Phạm vi phát hành MVP đã chọn

MVP theo hướng **vận hành clinic**, gồm:

- Tenant, cơ sở, Google Login, lời mời, RBAC và audit log.
- Nhân sự, nhiều phòng ban, đăng ký lịch ca và lịch sử chỉnh sửa.
- Video check-in, đi muộn, nghỉ, tiền phạt và luồng duyệt cần thiết.
- Booking, trạng thái khách, ảnh khách và ghi nhận công tour.
- KPI cơ bản từ doanh số, nhiệm vụ hoàn thành và tỷ lệ đi làm đúng giờ.
- Dynamic forms, chat nội bộ, push notification và ứng dụng mobile phục vụ các luồng trên.
- Xuất báo cáo XLSX cơ bản.

Ngoài phạm vi MVP: cây OKR nâng cao Company → Department → Individual, weekly OKR check-in, chống ảnh trùng bằng perceptual hash, PDF export và giao diện workflow builder tổng quát. Nền tảng dữ liệu được thiết kế có điểm mở rộng nhưng không triển khai trước nhu cầu MVP.

## 2. Người dùng, tổ chức và quyền hạn

Các vai trò sản phẩm:

1. System Admin.
2. Tenant Owner/Quản trị viên tenant.
3. Manager/Trưởng phòng hoặc quản lý trực tiếp.
4. Employee/Nhân viên.
5. Customer/Khách hàng.

Trong MVP, `Customer` là hồ sơ khách hàng nghiệp vụ, chưa phải tài khoản đăng nhập hoặc tenant membership. Vai trò/tài khoản Customer được giữ làm điểm mở rộng cho phiên bản sau.

Yêu cầu tổ chức:

- Một nhân viên có thể thuộc nhiều phòng ban.
- Trong MVP, tại một thời điểm mỗi nhân viên chỉ làm việc tại đúng **một cơ sở** trong tenant. Khi chuyển cơ sở phải kết thúc phân công cũ rồi tạo phân công mới có hiệu lực kế tiếp; toàn bộ lịch sử phân công được giữ lại.
- Backend phải từ chối các khoảng phân công cơ sở chồng lấn trong transaction. Nếu dữ liệu cũ bất ngờ có không có cơ sở hoặc nhiều cơ sở cùng hiệu lực, các nghiệp vụ tính KPI/phạt phải dừng an toàn, tạo cảnh báo chất lượng dữ liệu và không tự chọn cơ sở để phạt.
- Mỗi ca làm, check-in, booking và công tour của nhân viên phải thuộc đúng cơ sở đang có hiệu lực tại thời điểm nghiệp vụ.
- Quyền xem/quản lý dữ liệu của nhân viên tại từng cơ sở vẫn tuân theo branch-scoped RBAC; việc được phân công làm ở cơ sở không tự động cấp quyền quản lý cơ sở đó.
- Quyền được cấp theo membership trong tenant, không dựa trên danh sách ID trong biến môi trường.
- Đăng nhập bằng Google; Google chỉ cung cấp danh tính xác thực, không được xem tên trong hồ sơ Google là họ tên nhân viên có thẩm quyền.
- Ở lần đăng nhập đầu tiên, trước khi tạo hoặc tham gia tenant, hệ thống luôn hiển thị bước nhập/xác nhận **họ và tên** bắt buộc. Có thể điền sẵn tên Google nếu có nhưng người dùng vẫn phải chủ động xác nhận hoặc sửa; không được bỏ qua bước này khi Google không trả về tên.
- Khi người dùng tham gia tenant, hệ thống tạo `membership_display_name` từ họ tên đã xác nhận để hiển thị trong chat, báo cáo, KPI, lịch làm và các màn hình quản lý nhân viên. Người có permission quản lý thành viên được sửa tên hiển thị khi cần; mọi thay đổi phải lưu giá trị trước/sau, người thao tác và thời điểm.
- Tin nhắn và mọi bản ghi nghiệp vụ phải tham chiếu `tenant_membership_id` ổn định để xác định đúng nhân viên; họ tên chỉ dùng để hiển thị vì nhiều người có thể trùng tên hoặc thay đổi tên. Ở màn hình quản lý cần hiển thị thêm cơ sở, phòng ban/vị trí hoặc mã nhân viên khi cần phân biệt người trùng tên.
- Người tạo tenant trở thành Tenant Owner.
- Thành viên tham gia tenant hoặc nhóm bằng mã mời hay liên kết mời có thời hạn và có thể thu hồi.
- Mọi thay đổi membership, quyền, lịch làm, KPI và trạng thái nghiệp vụ quan trọng phải có audit log.

## 3. Tenant mẫu

Tạo seed tenant **Công ty TNHH ABC** với:

- Nhiều cơ sở clinic.
- Khoảng 30 nhân viên, gồm quản trị viên, trưởng phòng và nhân viên.
- Mỗi nhân viên mẫu có đúng một cơ sở hiện hành; lịch khách và dữ liệu vận hành được gắn với cơ sở đó.
- Ba biểu mẫu động ban đầu: báo cáo công việc, xin nghỉ phép và chấm công.
- KPI mẫu: doanh số, số nhiệm vụ hoàn thành và tỷ lệ đi làm đúng giờ.
- Hai ca làm bắt đầu lúc 08:30 và 09:30 theo múi giờ tenant.

Seed data phải có tính quyết định để có thể dùng trong test và chạy lại mà không tạo bản ghi trùng.

## 4. KPI và OKR trong MVP

- Công ty hiện chưa dùng chu kỳ OKR/KPI cố định.
- Người có quyền quản lý được sửa KPI riêng của từng nhân viên trực tiếp trong hệ thống.
- Mọi lần sửa phải lưu phiên bản, người sửa, thời điểm và giá trị trước/sau.
- KPI có thể lấy số liệu từ form động và dữ liệu nghiệp vụ, gồm doanh số, nhiệm vụ hoàn thành và tỷ lệ đúng giờ.
- Chống ảnh trùng bằng perceptual hash **không thuộc MVP**. Chỉ giữ điểm mở rộng trong mô hình dữ liệu/job; không tự động kết luận ảnh gian lận trong MVP.
- Các quy tắc ảnh minh chứng, nợ ảnh và phạt ảnh chỉ được kích hoạt cho loại KPI/form đã cấu hình.

### 4.1 Báo cáo KPI hằng ngày

- Báo cáo công việc/KPI là **báo cáo hằng ngày**, không phải weekly check-in.
- Khung giờ nộp báo cáo là từ **18:00 đến 20:00** theo múi giờ của tenant.
- Báo cáo dùng Dynamic Form có phiên bản. Nhân viên có thể cập nhật trong khung giờ; hệ thống giữ lịch sử từng lần lưu và tạo snapshot để đánh giá khi đóng kỳ ngày.
- Sau 20:00, job nền đánh giá KPI hằng ngày của từng nhân viên từ form submission và dữ liệu nghiệp vụ có liên quan.
- Nhân viên phải đạt **tất cả KPI bắt buộc** áp dụng cho mình trong ngày. Chỉ cần một KPI bắt buộc chưa đạt thì ngày đó được đánh giá là không đạt; không dùng điểm tổng hợp có trọng số trong MVP.
- Không nộp báo cáo hoặc nộp sau 20:00 cũng được đánh giá là không đạt KPI hằng ngày.
- Mỗi nhân viên chỉ bị tạo **một khoản phạt KPI hằng ngày**, mặc định **100.000 VND/người/ngày**, dù thiếu một hay nhiều KPI. Mức tiền phải cấu hình và có phiên bản theo tenant để có thể thay đổi mà không làm sai lịch sử.
- Khóa idempotency của khoản phạt phải ngăn tạo trùng theo tenant, nhân viên, ngày nghiệp vụ và policy scope.
- Job đánh giá và tạo phạt phải idempotent: chạy lại không được tạo khoản phạt trùng.
- Khoản phạt phải lưu ngày nghiệp vụ, KPI/target không đạt, số liệu thực tế, policy version và nguồn dữ liệu để quản lý kiểm tra.
- Nhân viên nghỉ hợp lệ hoặc không thuộc diện phải báo cáo trong ngày chỉ được miễn khi policy tenant quy định rõ; không suy ra miễn từ client.

#### Cấu hình cho doanh nghiệp có nhiều cơ sở

- Tenant Owner được chỉnh sửa chính sách báo cáo KPI cho **toàn doanh nghiệp, một cơ sở hoặc nhiều cơ sở được chọn trong cùng một thao tác**.
- Các trường được cấu hình gồm: giờ mở nhận báo cáo, giờ đóng báo cáo, giờ chạy đánh giá, mức phạt không đạt KPI và phạm vi nhân viên/KPI áp dụng.
- Chính sách cấp tenant là mặc định. Cơ sở có thể có policy override riêng; policy của cơ sở được ưu tiên hơn mặc định tenant trong thời gian có hiệu lực.
- Tenant Owner có thể áp dụng một cấu hình hàng loạt cho nhiều cơ sở nhưng hệ thống phải hiển thị rõ danh sách cơ sở bị ảnh hưởng trước khi lưu.
- Mỗi thay đổi tạo một policy version mới với `effective_from`, người sửa, thời điểm sửa, giá trị trước/sau và danh sách cơ sở áp dụng.
- Không được sửa ngược kết quả của ngày đã đóng. Khoản phạt đã tạo luôn tham chiếu đúng policy version đã dùng; điều chỉnh sau đó phải tạo giao dịch điều chỉnh có audit.
- Mọi thao tác cấu hình phải tenant-scoped và chỉ người có permission tương ứng mới được thực hiện; Tenant Owner có quyền mặc định, không dùng ID hard-code.

## 5. Đăng ký lịch làm

- Tenant mẫu có hai ca 08:30 và 09:30.
- Nhân viên có thể đăng ký ca từ đầu tuần hoặc trước nhiều tuần.
- Nhân viên được đăng ký ca lần đầu vào bất kỳ thời điểm nào trước khi ca bắt đầu, kể cả đăng ký trước nhiều tuần.
- Nhân viên được tự sửa ca khi thời điểm bắt đầu ca còn cách trên 24 giờ.
- Trong vòng 24 giờ trước ca, nhân viên không được sửa trực tiếp mà phải gửi yêu cầu đổi ca; lịch cũ tiếp tục có hiệu lực cho đến khi quản lý phê duyệt.
- Sau khi ca đã bắt đầu, chỉ người có permission quản lý mới được tạo điều chỉnh với lý do bắt buộc. Điều chỉnh phải tạo phiên bản/audit mới, không ghi đè bản ghi lịch hoặc chấm công ban đầu.
- Luồng duyệt đổi ca phải idempotent, gửi thông báo cho người duyệt và ngăn hai quyết định đồng thời làm lịch rơi vào trạng thái mâu thuẫn.
- Hệ thống phải lưu toàn bộ lịch sử tạo và chỉnh sửa lịch, gồm người thao tác, thời gian, ca cũ, ca mới và lý do nếu có.
- Phiên bản lịch áp dụng tại thời điểm check-in phải được lưu cùng bản ghi chấm công để phép tính lịch sử không thay đổi khi lịch bị sửa sau đó.

## 6. Check-in video và đi muộn

### 6.1 Check-in tiêu chuẩn

- Bắt buộc check-in bằng video quay rõ người và khu vực làm việc thực tế.
- Trước lần check-in video đầu tiên trong tenant, nhân viên phải xem và chủ động xác nhận chính sách video đang có hiệu lực. Hệ thống phải yêu cầu xác nhận lại khi một phiên bản chính sách có thay đổi quan trọng bắt đầu có hiệu lực; chưa xác nhận thì không được mở bước quay hoặc tải video check-in.
- Bằng chứng xác nhận phải lưu tối thiểu `tenant_id`, `tenant_membership_id`, policy version, thời điểm server, phiên đăng nhập/thiết bị ở mức phù hợp và hành động xác nhận. Không được suy ra sự đồng ý chỉ từ việc người dùng đã đăng nhập hoặc đã từng gửi video theo phiên bản cũ.
- Tiêu chuẩn tác phong: đồng phục chỉn chu, mặt trang điểm, đầu tóc gọn gàng, giày dép sạch sẽ.
- Không check-in hoặc check-in không đạt tiêu chuẩn: phạt 50.000 VND/lần.
- Trước mỗi ca 15 phút, bot hệ thống phải gửi thông báo vào kênh/nền tảng thông báo nội bộ phù hợp và tag tên các nhân viên có lịch ca đó nhưng chưa check-in video. Thông báo phải tenant/branch-scoped, không gửi trùng khi worker retry và không tag nhân viên đang `OFF` hoặc nghỉ hợp lệ.
- Trước mốc 12:00 khoảng 1 tiếng, mặc định 11:00 theo múi giờ tenant, hệ thống phải gửi cảnh báo check-in lần cuối và tag tên các nhân viên có lịch làm trong ngày nhưng vẫn chưa check-in video. Cảnh báo cuối phải tenant/branch-scoped, không gửi trùng khi worker retry và không tag nhân viên đang `OFF` hoặc nghỉ hợp lệ.
- Với ngày có ca làm và không phải `OFF`/nghỉ hợp lệ, nhân viên phải có video check-in trước 12:00 trưa theo múi giờ tenant. Đến 12:00 chưa có check-in thì hệ thống tạo lỗi không thực hiện check-in 50.000 VND theo policy; check-in hoặc xác nhận bổ sung sau đó chỉ dùng để xác định có đi làm và tính đi muộn, không tự xóa lỗi không check-in trước 12:00.
- Trong MVP, hệ thống lưu video và kết quả duyệt. Không mặc định dùng AI để tự kết luận trang điểm, đồng phục hay độ sạch; cần người có quyền duyệt nếu chưa có mô hình được kiểm chứng.

### 6.2 Đi muộn

- Áp dụng cho cả ca 08:30 và 09:30.
- Đi muộn vẫn tính đủ ngày công.
- Số phút đi muộn được tính từ timestamp check-in do server ghi nhận so với thời điểm bắt đầu của phiên bản lịch áp dụng, theo múi giờ tenant.
- Chỉ tính số phút tròn đã qua: `late_minutes = floor(max(0, check_in_at - shift_start_at) / 60 giây)`. Ví dụ 08:30:59 cho kết quả 0 phút; 08:45:59 cho kết quả 15 phút; 08:46:00 cho kết quả 16 phút.
- Hệ thống phải lưu cả timestamp gốc, lịch áp dụng, số giây chênh lệch và số phút sau khi làm tròn để có thể audit phép tính.
- Khi `late_minutes = 0`, nhân viên được coi là đúng giờ hoàn toàn: không tạo late occurrence, không dùng lượt miễn đi muộn đầu tiên, không phát sinh phạt và không bị đẩy xuống cuối hàng đợi nhận khách.
- Mỗi nhân viên được miễn **tiền phạt cơ bản theo số phút** cho lần đi muộn đầu tiên trong tháng; việc miễn này không miễn nghĩa vụ báo trước.
- Từ lần đi muộn thứ hai trong tháng:
  - Từ 1 đến 15 phút: phạt cố định 20.000 VND/lần.
  - Từ 16 đến 89 phút: phạt `2.000 VND × tổng số phút đi muộn`. Ví dụ muộn 16 phút phạt 32.000 VND; muộn 89 phút phạt 178.000 VND.
  - Từ 90 phút trở lên: 200.000 VND/lần.
- Chỉ được giảm 50% tiền phạt cơ bản khi nhân viên gửi đơn xin đi muộn trong nhóm chat chung trước giờ vào ca ít nhất 30 phút **và đơn được quản lý phê duyệt**.
- Quản lý có thể phê duyệt sau giờ vào ca. Trong lúc chờ, hệ thống giữ mức phạt tạm tính; khi đơn được duyệt, hệ thống đối soát giảm 50% bằng một điều chỉnh có audit thay vì sửa mất lịch sử ban đầu.
- Không tự động giảm chỉ vì nhân viên có đi muộn, báo sau thời hạn hoặc đơn chưa/không được duyệt.
- Không báo đúng hạn: giữ 100% tiền phạt cơ bản nếu lần đó có phát sinh và cộng thêm 100.000 VND lỗi không báo cáo.
- Quy tắc cộng 100.000 VND lỗi không báo áp dụng cả cho lần đi muộn đầu tiên trong tháng. Ở lần đầu, tiền phạt cơ bản bằng 0 nhưng khoản phạt không báo vẫn là 100.000 VND.
- Nhân viên đi muộn bị đẩy xuống cuối hàng đợi nhận khách mới hoặc khách vãng lai trong ngày tại cơ sở liên quan.
- Tiền phạt được tổng hợp cuối tháng vào quỹ nội bộ của clinic; hệ thống phải giữ chi tiết nguồn phát sinh, không chỉ tổng tiền.

Penalty policy phải cấu hình và có phiên bản theo tenant để tenant khác có thể dùng quy định khác mà vẫn tái hiện đúng phép tính lịch sử.

### 6.3 Quy tắc gộp phạt video và đi muộn cùng ngày

- Nếu cùng ngày nghiệp vụ nhân viên vừa có video check-in không đạt vừa đi muộn, không cộng hai khoản phạt cơ bản; chỉ thu **khoản cao hơn**.
- Hệ thống vẫn lưu hai violation riêng để audit, nhưng penalty settlement áp dụng quy tắc `max(video_penalty, final_late_base_penalty)`.
- `final_late_base_penalty` là phần phạt đi muộn sau khi áp dụng miễn lần đầu và giảm 50% nếu đơn xin đi muộn hợp lệ đã được duyệt.
- Khoản 100.000 VND lỗi không báo trước là lỗi độc lập và vẫn được cộng sau khi chọn khoản cao hơn giữa video và đi muộn.
- Ví dụ video không đạt 50.000 VND và đi muộn 16 phút có phạt cơ bản 32.000 VND: thu 50.000 VND. Nếu đồng thời không báo trước, tổng thu là 150.000 VND.
- Phép tính phải lưu từng thành phần, rule version, khoản bị suppress và lý do `MAX_OF_VIDEO_AND_LATE` để báo cáo giải thích được.

### 6.4 Sổ phạt và quy trình nộp tiền

- MVP quản lý sổ phạt nội bộ; không tự động trừ lương, không phụ thuộc module payroll và chưa tích hợp cổng thanh toán.
- Nhân viên có thể nộp bằng tiền mặt hoặc chuyển khoản. Với chuyển khoản có thể đính kèm ảnh/chứng từ; với tiền mặt, người thu tiền ghi nhận trực tiếp.
- Mỗi khoản phạt phải tham chiếu đúng nguồn phát sinh, policy version, số tiền gốc, các điều chỉnh, số tiền còn phải nộp và kỳ tổng hợp tháng.
- Trạng thái chuẩn: `PENDING → SUBMITTED → CONFIRMED`. Hỗ trợ thêm `REJECTED`, `WAIVED` và `REFUNDED` khi người có permission thực hiện với lý do bắt buộc.
- Nhân viên chỉ được gửi thông tin/chứng từ nộp tiền; chỉ quản lý/kế toán có permission mới được xác nhận, từ chối, miễn hoặc hoàn tiền.
- Chuyển trạng thái, xác nhận và hoàn tiền phải idempotent, có audit và không được làm mất lịch sử số tiền trước/sau.
- Cuối tháng hệ thống tổng hợp theo tenant, cơ sở, nhân viên, loại lỗi, trạng thái nộp và tổng tiền đã xác nhận vào quỹ nội bộ.

## 7. Nghỉ đột xuất và lịch nghỉ

- Nghỉ đột xuất phải thông báo rõ trong nhóm chat chung của công ty.
- Tự ý nghỉ không thông báo: phạt 50.000 VND/lần.
- Mỗi tháng được tối đa một ngày nghỉ đột xuất; từ ngày thứ hai: phạt 100.000 VND/lần.
- Lỗi không thông báo và lỗi vượt giới hạn nghỉ đột xuất là hai lỗi độc lập và được cộng dồn. Ví dụ nghỉ đột xuất lần thứ hai trong tháng mà không thông báo: 50.000 + 100.000 = 150.000 VND.
- Quy tắc không cho nghỉ trùng chỉ áp dụng giữa các nhân viên **cùng cơ sở và cùng bộ phận/vị trí** trong khoảng thời gian nghỉ bị chồng lấn. Nhân viên thuộc hai cơ sở khác nhau được phép nghỉ trùng ngày.
- Nếu một nhân viên thuộc nhiều bộ phận/vị trí, hệ thống xác định xung đột theo các phân công còn hiệu lực tại cơ sở và ngày nghỉ liên quan; chỉ cần trùng một bộ phận/vị trí là đơn nghỉ bị xem là xung đột.
- Backend phải kiểm tra xung đột khi gửi và khi phê duyệt đơn trong transaction, dựa trên phiên bản phân công có hiệu lực; không chỉ dựa vào dữ liệu đang hiển thị trên mobile. Đơn xung đột không được phê duyệt và phải trả về cơ sở, bộ phận/vị trí cùng đơn nghỉ gây xung đột để người dùng xử lý.
- Không được nghỉ liên tiếp hai ngày, kể cả nối từ tuần trước sang tuần sau.
- Tự ý nghỉ sai quy định: phạt 200.000 VND/lần.
- Có thể duyệt ngoại lệ nghỉ hai ngày liên tiếp khi:
  - Đi bệnh viện và nộp giấy khám bệnh/giấy ra viện.
  - Đi đám cưới và nộp ảnh tại đám cưới.
  - Trường hợp đặc biệt được Tenant Owner hoặc quản lý trực tiếp duyệt trước.
- Luồng duyệt phải hỗ trợ một cấp, nhiều cấp tuần tự và nhiều người duyệt song song theo cấu hình tenant.

## 8. Booking và ghi nhận công tour

- Chỉ nhân viên hoặc người dùng nội bộ có permission phù hợp mới được tạo, sửa và quản lý booking trong MVP.
- Khách hàng chưa đăng nhập bằng Google, chưa tự chọn lịch và chưa tự đặt booking trong MVP.
- Hồ sơ khách hàng được quản lý tenant-scoped, giới hạn trường dữ liệu cá nhân theo nhu cầu booking và chỉ hiển thị cho người có quyền tại cơ sở liên quan.
- Lịch khách phải thuộc tenant và một cơ sở cụ thể; nhân viên phụ trách phải được xác định.
- Cùng loại dịch vụ có thể xuất hiện tại nhiều cơ sở nhưng lịch và nhân viên giữa các cơ sở không được trộn lẫn.
- Đến giờ hẹn, nhân viên cập nhật một trong các kết quả hợp lệ:
  - Khách đã đến: đánh dấu `ARRIVED` và gửi ảnh khách hàng.
  - Khách không đến hoặc hủy: chọn trạng thái phù hợp và bắt buộc nêu lý do.
  - Đặt lịch khác: tạo/reschedule sang lịch mới và bắt buộc nêu lý do.
- Trước khi mở camera hoặc tải ảnh khách hàng lên, nhân viên phải xác nhận đã thông báo và nhận được sự đồng ý của khách theo chính sách đang có hiệu lực. Bằng chứng xác nhận phải gắn với tenant, cơ sở, booking/công tour, khách hàng, `tenant_membership_id` của người thao tác, thời điểm server, phương thức đồng ý và policy version.
- MVP không yêu cầu khách hàng tạo tài khoản hoặc ký điện tử. Việc nhân viên đánh dấu xác nhận là bằng chứng thao tác nội bộ; nếu chưa có xác nhận thì hệ thống không được nhận/lưu ảnh và công tour chưa đủ điều kiện hoàn thành.
- Chỉ ghi nhận một **công tour hoàn chỉnh** khi lịch ở trạng thái hoàn thành hợp lệ và ảnh khách bắt buộc đã được nộp.
- Mọi chuyển trạng thái phải có lịch sử, người thao tác, thời điểm và lý do/dữ liệu minh chứng liên quan.

### 8.1 Chặn trùng và ngoại lệ “Khách đến luôn”

- Với booking hẹn trước thông thường, trong cùng một cơ sở, giờ bắt đầu của hai booking thuộc **cùng một nhân viên phụ trách** phải cách nhau ít nhất 60 phút.
- Hai nhân viên khác nhau được phép có booking cùng giờ. MVP chưa chặn theo phòng, máy hoặc giường.
- Quy tắc 60 phút phải được kiểm tra transactionally tại database/service boundary, không chỉ kiểm tra trước ở giao diện; hai request đồng thời không được tạo hai booking hẹn trước vi phạm quy tắc.
- Form tạo booking có checkbox **“Khách đến luôn”** dành cho khách walk-in đang có mặt tại cơ sở.
- Khi chọn “Khách đến luôn”:
  - Booking được phân loại `WALK_IN` và chuyển ngay sang `ARRIVED` bằng thời gian server.
  - Không áp dụng kiểm tra khoảng cách 60 phút; nhân viên có thể nhận khách ở bất kỳ thời điểm nào.
  - Vẫn bắt buộc nộp ảnh khách và hoàn tất các bước công tour như booking thông thường.
  - Hệ thống lưu người thao tác, cơ sở, thời điểm server và lịch sử trạng thái.
- Không được dùng “Khách đến luôn” để tạo trước một lịch tương lai. Sau khi tạo, loại `WALK_IN` không được đổi âm thầm thành booking hẹn trước hoặc ngược lại; mọi sửa chữa quản trị phải có permission, lý do và audit.

### 8.2 Báo cáo lịch khách theo giờ

- Lúc **20:08** hằng ngày, hệ thống tự động tổng hợp và đăng báo cáo lịch khách của **ngày hôm sau**.
- Lúc **22:00** hằng ngày, hệ thống tự động tổng hợp và đăng báo cáo kết quả lịch khách của **ngày hiện tại**.
- Hai job chạy theo múi giờ tenant, tách dữ liệu theo tenant và cơ sở, đồng thời có thể nhóm theo nhân viên phụ trách.
- Báo cáo 20:08 lấy snapshot các lịch ngày mai cùng trạng thái hiện tại để phục vụ chuẩn bị và điều phối.
- Báo cáo 22:00 tổng hợp tối thiểu số lịch, khách đã đến, công tour hoàn chỉnh, no-show, hủy, đổi lịch, lý do và các trường hợp còn thiếu ảnh.
- Báo cáo được đăng vào nhóm chat nội bộ phù hợp và lưu bản ghi lần chạy, phạm vi dữ liệu, thời điểm cùng kết quả gửi.
- Các job phải idempotent, retry-safe và cho phép người có quyền chạy lại; chạy lại không được tạo bản tổng hợp hoặc thông báo trùng ngoài ý muốn.

## 9. Trung tâm “Việc cần hoàn thành”

Ứng dụng mobile phải có một giao diện tập trung tên **Việc cần hoàn thành**, xuất hiện nổi bật trên Dashboard và có badge tổng số việc còn thiếu.

### 9.1 Dành cho nhân viên

- Hiển thị các việc của chính nhân viên, sắp xếp theo hạn gần nhất và mức độ khẩn cấp.
- Nhóm việc tối thiểu:
  - Báo cáo KPI hôm nay chưa nộp, nộp muộn hoặc còn KPI bắt buộc chưa đạt.
  - Công tour khách chưa hoàn thành.
  - Booking đến giờ nhưng chưa cập nhật `ARRIVED`, `NO_SHOW`, `CANCELLED` hoặc reschedule.
  - Booking đã `ARRIVED` nhưng còn thiếu ảnh khách hoặc bước hoàn tất công tour.
  - Video check-in, ảnh minh chứng hoặc biểu mẫu bắt buộc còn thiếu.
  - Đơn từ cần nhân viên bổ sung thông tin hoặc minh chứng.
- Với mỗi KPI, hiển thị tên KPI, giá trị mục tiêu, giá trị đã đạt, **phần còn thiếu**, đơn vị tính, thời hạn và trạng thái dữ liệu gần nhất.
- Với công tour, hiển thị cơ sở, giờ hẹn, booking liên quan, bước còn thiếu và nút hành động dẫn thẳng đến màn hình cần hoàn thành.
- Trạng thái chuẩn gồm `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `OVERDUE` và `DONE`.
- Khi dữ liệu nguồn thay đổi, danh sách và badge phải cập nhật gần realtime; retry hoặc refresh không được tạo việc trùng.

### 9.2 Dành cho quản lý và Tenant Owner

- Có chế độ tổng hợp theo tenant, một cơ sở hoặc nhiều cơ sở mà người dùng được phép quản lý.
- Lọc theo cơ sở, phòng ban, nhân viên, loại việc, trạng thái và ngày nghiệp vụ.
- Hiển thị số nhân viên thiếu báo cáo, số KPI chưa đạt, số công tour chưa hoàn thành, số booking thiếu trạng thái/ảnh và các việc đã quá hạn.
- Cho phép mở chi tiết tới đúng nhân viên và bản ghi nguồn nhưng vẫn tuân thủ RBAC, tenant scope và branch scope.

### 9.3 Nguồn dữ liệu và tính nhất quán

- Backend tạo action-item feed từ dữ liệu có thẩm quyền của KPI, form submission, booking, media, attendance và approval; mobile không tự kết luận nghiệp vụ từ dữ liệu cache.
- Mỗi action item phải tham chiếu loại nguồn và `source_id`, có khóa duy nhất theo tenant/người phụ trách/loại việc/nguồn/ngày nghiệp vụ để chống trùng.
- Hoàn thành hoặc hủy nghiệp vụ nguồn phải đóng action item tương ứng một cách idempotent và giữ lịch sử thay đổi.
- Nhấn vào một action item phải deep-link tới đúng form, booking, video, ảnh hoặc đơn từ liên quan.

## 10. Thương hiệu Adsup

- Logo nguồn: `assets/brand/adsup-logo-source.png`.
- Tên sản phẩm chính thức và tên hiển thị chính trên mobile, metadata, thông báo và tài liệu là **Adsup**.
- Cụm **“Agency CRM”** là tagline tùy ngữ cảnh, không phải một phần bắt buộc của tên sản phẩm trên mọi màn hình.
- Logo nguồn thể hiện chữ “ADSUP agency CRM” và được giữ nguyên làm tài sản tham chiếu; không ghi đè hoặc chỉnh sửa phá hủy file nguồn.
- Được phép dựng lại bộ vector và app icon đơn giản từ chữ U/mũi tên đi lên của logo nguồn. Biến thể phải giữ nhận diện, tỷ lệ hợp lý và bảng màu Adsup, dễ đọc ở kích thước app icon; không tự ý thêm biểu tượng hoặc màu ngoài hệ thống đã duyệt.
- Bộ tài sản dẫn xuất phải gồm tối thiểu SVG/vector master, app icon iOS/Android, adaptive icon, favicon và biến thể sáng/tối phù hợp; mọi file có tên/version rõ ràng và được kiểm tra ở kích thước nhỏ trước khi dùng.
- Hướng màu lấy từ logo:
  - Navy đậm: `#051240`.
  - Navy: `#14336E`.
  - Xanh chủ đạo: `#2C6ABA`.
  - Xanh tương tác: `#2A82D5`.
  - Cyan: `#38A1E7`.
  - Cyan sáng: `#5BC4F2`.
  - Nền: `#FFFFFF` và `#EEF3F9`.
- Màu chữ, trạng thái và CTA phải đạt WCAG AA; không dùng màu đơn độc để truyền đạt trạng thái.
- Không kéo giãn, đổi tỷ lệ, recolor hay thêm hiệu ứng lên logo nguồn.

## 11. Kiến trúc phục vụ nhiều người online

Kiến trúc mặc định:

- Monorepo TypeScript.
- API Node.js/Express stateless, có thể scale ngang.
- PostgreSQL/Prisma với tenant isolation, connection pooling, index theo tenant/cơ sở/thời gian và migration có kiểm soát.
- Redis cho cache ngắn hạn, rate limit, hàng đợi và Socket.io Redis adapter khi chạy nhiều API instance.
- Background worker riêng cho video, thông báo, export và các tác vụ nặng.
- Object storage tương thích S3 cùng CDN/signed URL cho ảnh và video.
- Socket.io cho chat realtime; FCM/APNs cho push notification.
- Idempotency, audit log, observability, backup/restore và test cô lập tenant là yêu cầu bắt buộc.

### 11.1 Capacity target của MVP

Hệ thống được thiết kế và kiểm thử theo profile **Tăng trưởng MVP**:

- 100 tenant.
- Tối đa khoảng 500 cơ sở.
- 10.000 tài khoản người dùng.
- 2.000 người online/realtime connection đồng thời.
- 200 API request/giây ở tải mục tiêu.
- 20.000 booking/ngày.
- 10.000 video check-in/ngày.

Các con số trên là mục tiêu thiết kế, load test và cảnh báo capacity, không phải hard limit trong business logic. API stateless, worker, Socket.io adapter, PostgreSQL pool và object storage phải có khả năng scale ngang khi tải tăng. Hạ tầng production thực tế sẽ được định cỡ theo kết quả load test và ngân sách. Local/test vẫn dùng adapter hoặc test double và không yêu cầu credential cloud thật.

### 11.2 Retention policy mặc định

- Video check-in: lưu 180 ngày.
- Ảnh minh chứng của nhân viên: lưu 365 ngày.
- Ảnh khách hàng gắn với booking/công tour: lưu 180 ngày.
- File export XLSX: lưu 30 ngày.
- Metadata nghiệp vụ và audit log không chứa binary media: lưu 5 năm.
- Tenant Owner có thể cấu hình thời gian lưu theo tenant trong giới hạn chính sách nền tảng. Mỗi thay đổi phải có version, `effective_from`, người sửa và audit; không tự ý khôi phục media đã xóa.
- Background retention job phải tenant-scoped, idempotent và xóa cả object gốc, derivative/thumbnail cùng quyền truy cập liên quan khi hết hạn.
- Sau khi xóa media, giữ tombstone metadata cần thiết gồm loại media, checksum/identifier, thời điểm tạo, thời điểm xóa, retention policy version và người/job thực hiện; không giữ lại nội dung binary đã hết hạn.
- Hỗ trợ legal hold có permission và lý do bắt buộc để tạm dừng xóa đối với bản ghi cụ thể. Mọi legal hold và lần gỡ hold phải được audit.
- Trước production phải có nội dung thông báo/đồng ý phù hợp cho video nhân viên và ảnh khách hàng; retention policy kỹ thuật không thay thế việc rà soát pháp lý và chính sách nội bộ.
