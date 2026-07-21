# RBAC và phạm vi tenant

Role hệ thống mỗi tenant gồm `TENANT_OWNER`, `MANAGER`, `EMPLOYEE`; permission là catalog toàn
cục bất biến. Quyền hiệu lực đến từ role binding đang hoạt động ở phạm vi `TENANT` hoặc
`BRANCH`. Assignment chỉ mô tả nơi làm việc và không tự cấp quyền.

Mỗi request tenant lấy `userId` từ JWT, tìm membership theo `tenantId` trên URL, rồi tính quyền
từ binding trên backend. ID ở path/body chỉ là selector. Truy cập chéo tenant trả lỗi an toàn và
không xác nhận tài nguyên có tồn tại. Hệ thống không cho khóa thành viên là Tenant Owner cuối cùng.

Permission Module 1: `tenant.read`, `branch.manage`, `organization.manage`, `member.read`,
`member.invite`, `member.manage`, `role.read`, `role.manage`, `form.read`, `form.manage`,
`form.submit`, `chat.read`, `chat.write`, `chat.manage`, `media.create`, `media.read`, `audit.read`.
