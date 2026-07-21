# Skill: Chuyên gia Kiến trúc Hệ thống (System Architect & Database)

## 1. Mục tiêu

Khởi tạo cấu trúc dự án Backend (Node.js/Express) và thiết kế Cơ sở dữ liệu (PostgreSQL) cho một Mobile App SaaS quản lý OKR, Nhân sự và Quy trình.

Tuyệt đối KHÔNG phụ thuộc vào Telegram, Google Sheets hay Local Storage.

## 2. Yêu cầu Thiết kế Database (BẮT BUỘC)

- **Kiến trúc Multi-tenant (Đa doanh nghiệp) [2]:** Mọi bảng dữ liệu phải có `tenant_id` (ID Doanh nghiệp) để đảm bảo dữ liệu của công ty này cô lập hoàn toàn với công ty khác.
- **Thiết kế Dynamic Forms (Biểu mẫu động) [3]:**
  - Tạo bảng `form_templates` để lưu cấu trúc biểu mẫu, ví dụ schema JSON quy định các trường text, number, dropdown.
  - Tạo bảng `form_submissions` sử dụng kiểu dữ liệu `JSONB` trong PostgreSQL để lưu dữ liệu người dùng nhập vào. Điều này giúp hệ thống linh hoạt cho cả Thẩm mỹ viện, Bất động sản hay IT mà không cần cố định cột `tin_nhan` hay `doanh_thu` như cũ.
- **Bảo mật & Phân quyền (RBAC):** Tạo các bảng `Users`, `Roles`, `Permissions`. KHÔNG dùng `ADMIN_IDS` trong file `.env`. Sử dụng JWT để xác thực API.

## 3. Hạ tầng Đám mây (Cloud Infrastructure)

- **Lưu trữ:** Tích hợp AWS S3 hoặc tương đương để upload toàn bộ ảnh minh chứng và video check-in.
- **Giao tiếp:** Thiết lập Socket.io cho luồng Chat thời gian thực.
- **Thông báo:** Tích hợp Firebase Cloud Messaging (FCM) / APNs để thay thế cronjob gửi tin nhắn Telegram bằng Push Notification.

## 4. Nhiệm vụ của AI

Sinh mã nguồn tạo Database Schema bằng SQL/Prisma/TypeORM bao gồm các bảng trên và setup cấu trúc thư mục MVC chuẩn.
