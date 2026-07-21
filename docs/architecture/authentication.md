# Xác thực Adsup

Module 1 dùng Google `sub` làm khóa định danh ổn định. Email và tên Google chỉ là metadata;
người dùng phải xác nhận họ tên 2–120 ký tự trước khi tạo hoặc tham gia tenant.

Access JWT HS256 dùng trong local, sống 15 phút mặc định và chứa `sub`, `sid`, `iss`, `aud`.
Refresh token là chuỗi opaque, chỉ lưu SHA-256, xoay sau mỗi lần dùng. Dùng lại token đã xoay sẽ
thu hồi cả token family. Middleware kiểm tra cả trạng thái User và AuthSession trên backend.

`AUTH_GOOGLE_MODE=fake` chỉ dành cho local/test, token có dạng
`dev-google:<stable-subject>:<email>`. Production bắt buộc `AUTH_GOOGLE_MODE=google` và
`GOOGLE_CLIENT_ID`; không có đường fallback ngầm.
