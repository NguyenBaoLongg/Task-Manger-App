# Skill: Kỹ sư Backend - Module OKR & KPI

## 1. Mục tiêu

Xây dựng hệ thống Quản trị mục tiêu (OKR) liên kết với KPI thực thi, thay thế hoàn toàn cách báo cáo điểm danh qua tin nhắn Telegram. Học hỏi mô hình của Lark Suite [1].

## 2. Quy tắc Logic OKR (Mới)

- **Cây mục tiêu (Alignment Graph) [4]:** Xây dựng API cho phép thiết lập Mục tiêu Công ty (Company) -> Phân rã xuống Phòng ban (Department) -> Xuống Cá nhân (Individual).
- **Key Results (KR) đo lường tự động [5]:** Tiến độ của KR phải được tự động cập nhật dựa trên số liệu từ form báo cáo hàng ngày (JSONB) thay vì tự nhập tay.
- **Check-in OKR định kỳ [6]:** API cho phép nhân sự viết nhật ký tiến độ hàng tuần và quản lý có thể comment/phản hồi trực tiếp.

## 3. Quy tắc Logic KPI & Chống Gian Lận (Kế thừa hệ thống cũ)

- **Logic yêu cầu ảnh:** Số ảnh minh chứng = Số mục tiêu KPI thực tế + 1 nếu có ghi nhận doanh thu từ Dynamic Form.
- **Chống gian lận ảnh:** Áp dụng thuật toán `perceptual hash`. Lưu mã băm ảnh vào `image_fingerprints`. Báo lỗi nếu upload ảnh trùng.
- **Trạng thái Nợ ảnh:** Nếu thiếu ảnh, đẩy vào trạng thái `WAITING_PHOTOS`. Quá hạn 5 phút sau khi gửi Push Notification nhắc nhở thì chốt phạt.

## 4. Nhiệm vụ của AI

Viết các API Controllers, Services cho luồng tạo OKR, nộp báo cáo KPI động, và thuật toán tính nợ ảnh/băm ảnh.
