# Prompt điều phối xây dự án từ móng đến ngọn

Dán nguyên prompt dưới đây vào một task Codex mới sau khi khởi động lại Codex:

```text
$create-project-flexibly

Hãy xây dựng dự án Mobile SaaS quản lý OKR, KPI, nhân sự, quy trình, lịch khách và chat nội bộ từ các skill đã cài trong repository này.

Phạm vi phát hành là **MVP vận hành clinic (phương án A)** theo `docs/PRODUCT_REQUIREMENTS_MVP.md`. Các skill module cung cấp kiến thức và quality gates nhưng không được tự mở rộng sang tính năng được ghi ngoài MVP. Hoãn cây OKR nâng cao, weekly OKR check-in, perceptual-hash chống ảnh trùng, PDF export và workflow-builder tổng quát; vẫn giữ kiến trúc có điểm mở rộng phù hợp.

Mặc định kỹ thuật nếu repository chưa có code:
- Monorepo TypeScript.
- Backend: Node.js, Express, PostgreSQL, Prisma.
- Mobile: React Native, TypeScript, Expo; nếu một native capability không phù hợp Expo managed workflow thì ghi rõ và chọn prebuild/bare hợp lý.
- Shared API contracts và validation schemas dùng chung khi thực tế.

Thứ tự bắt buộc:
1. $design-multitenant-architecture
2. $build-okr-kpi-engine (KPI cơ bản, báo cáo hằng ngày 18:00–20:00 và penalty policy thuộc MVP)
3. $build-timekeeping-workflows
4. $build-booking-export (booking, báo cáo lịch tự động lúc 20:08/22:00 và XLSX cơ bản; chưa làm PDF)
5. $build-mobile-frontend cùng $ui-ux-pro-max và $design-system

Với từng module:
1. Đọc SKILL.md và file requirements được liên kết.
2. Dùng Spec Kit theo thứ tự:
   $speckit-specify
   $speckit-clarify nếu còn mơ hồ quan trọng
   $speckit-plan
   $speckit-checklist
   $speckit-tasks
   $speckit-analyze
   $speckit-implement
   $speckit-converge
3. Chỉ chuyển module tiếp theo khi migration, API contract, code và test bắt buộc của module hiện tại ổn định.
4. Nếu thiếu AWS/FCM/APNs credentials, tạo adapter, cấu hình mẫu và test double; không chặn local development và không giả báo đã kiểm thử dịch vụ thật.
5. Mọi bảng tenant-owned phải có tenant_id và mọi truy vấn phải tenant-scoped.
6. Không dùng ADMIN_IDS, Telegram, Google Sheets hoặc Local Storage làm nguồn dữ liệu/quyền hạn chính.
7. Sau mỗi module, báo cáo artifacts, files, migrations, API, tests, rủi ro và dependency gate của module tiếp theo.

Các ký hiệu nguồn [1]-[6] trong requirements chưa có URL. Không được bịa nguồn; coi nội dung requirements là yêu cầu người dùng và liệt kê citation nào cần bổ sung.

Bắt đầu bằng cách kiểm tra workspace và constitution. Nếu constitution chưa đủ, chạy $speckit-constitution. Sau đó thực hiện module 1. Chỉ dừng khi gặp quyết định sản phẩm không thể suy ra an toàn, cần credential thật, hoặc có lỗi môi trường không thể khắc phục trong workspace.

Trước khi tạo constitution hoặc specification, đọc `docs/PRODUCT_REQUIREMENTS_MVP.md` và dùng tài liệu này làm nguồn sự thật sản phẩm. Không tự suy diễn các mục nằm trong phần “Các quyết định còn phải xác nhận”.
```
