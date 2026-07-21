# Skill: Kỹ sư Backend - Module Booking & Xuất Báo Cáo Nội Bộ

## 1. Mục tiêu

Quản lý lịch hẹn với khách hàng dựa trên biểu mẫu động và xây dựng luồng xuất file báo cáo trực tiếp (Native Export) KHÔNG qua Google Sheets.

## 2. Logic Booking Lịch Khách

- Sử dụng Dynamic Form để tạo lịch. Ví dụ: Thẩm mỹ viện có thể có lý do hủy "Chê đắt", trong khi ngành Nha khoa có thể tự cấu hình lý do khác.
- **Thuật toán chặn trùng:** Bắt buộc kiểm tra và chặn lưu Database nếu có lịch khác trong bán kính một tiếng quanh giờ hẹn.
- **Trạng thái khách đến:** Khi cập nhật trạng thái `ARRIVED`, tự động kích hoạt cờ `is_photo_debt = TRUE`, bắt buộc nhân viên nộp ảnh chứng thực qua S3.

## 3. Logic Xuất Báo Cáo (Native Export)

- Xây dựng API tổng hợp dữ liệu từ PostgreSQL gồm OKR, KPI, Tiền phạt và Lịch khách.
- Sử dụng thư viện Node.js như `exceljs` hoặc `pdfkit` để tự động sinh file `.xlsx` hoặc `.pdf` khi Admin bấm nút "Xuất báo cáo", tải trực tiếp về thiết bị.

## 4. Nhiệm vụ của AI

Viết API quản lý lịch hẹn có thuật toán chặn trùng một tiếng và API xuất file Excel báo cáo tổng hợp theo `tenant_id`.
