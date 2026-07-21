# Skill: Kỹ sư Backend - Module Chấm công & Quy trình (BPM)

## 1. Mục tiêu

Xây dựng luồng chấm công bằng Video, quản lý quỹ phép và hệ thống duyệt đơn tự động (Low-code).

## 2. Logic Check-in Video

- Nhận video từ Mobile App, tự động convert định dạng `webm` sang `mp4` và đẩy lên Cloud Storage (S3).
- Tính phạt đi muộn dựa trên cấu hình `tenant_id`:
  - Lần 1: Miễn phạt.
  - Từ lần 2: Dưới 15 phút phạt X tiền; 15-90 phút phạt Y + Z/phút; trên 90 phút phạt mức Max. X, Y, Z là biến số cấu hình tùy doanh nghiệp.
  - Nếu có đơn xin đi muộn được duyệt thì giảm 50% phạt.

## 3. Quy trình Động (Dynamic Workflows) [3]

- **Tùy biến luồng duyệt:** Thay vì chỉ có một cấp duyệt, xây dựng API cho phép Admin tự định nghĩa luồng duyệt một cấp, hai cấp, hoặc duyệt song song.
- Khi nhân viên gửi đơn Nghỉ phép hoặc Đi muộn, hệ thống đẩy Push Notification đến người duyệt dựa trên luồng đã định nghĩa.
- Quản lý bấm duyệt qua API thì tự động trừ quỹ phép hoặc đổi lịch thành `OFF`.

## 4. Nhiệm vụ của AI

Viết các API cho Check-in Video, thuật toán tính phạt đi muộn nhiều cấp độ và hệ thống Routing cho phê duyệt đơn từ.
