# Contracts: API cho feature 008 (mobile)

Các hợp đồng dưới đây là **hợp đồng hiện hữu** của backend (trừ `me/permissions` — bổ sung
mới theo R3, đánh dấu **[NEW]**). Mobile phải gọi đúng các trường này; không đổi backend
ngoài endpoint [NEW].

## 1. Đăng nhập Google

`POST /v1/auth/google`

Request: `{ "idToken": string (20-8192), "deviceLabel"?: string }`

- idToken Google OIDC (audience = GOOGLE_CLIENT_ID của API).
- Chế độ fake (dev): idToken `dev-google:<subject>:<email>`.

Response 200:

```json
{ "user": { "id", "fullName", "profileComplete", "status" }, "accessToken", "refreshToken", "expiresAt" }
```

Lỗi: 401 `AUTHENTICATION_REQUIRED` (token không hợp lệ), 403 `AUTHORIZATION_DENIED`
("Tài khoản đã bị khóa.").

## 2. Danh sách tenant của tôi

`GET /v1/me/tenants` (auth) — trả mảng `{ membershipId, tenantId, name, status, ... }`.
Dùng cho màn hình chọn workspace; sau khi accept lời mời phải gọi lại để làm mới (FR-009).

## 3. Danh sách vai trò

`GET /v1/tenants/:tenantId/roles` (auth + tenant context + quyền `role.read`)

Response 200: mảng `{ id, name, code, kind, permissionCodes: string[] }`.

Lỗi: 403 `AUTHORIZATION_DENIED` khi thiếu quyền — màn hình mời ẩn lối vào từ trước (FR-007).

## 4. Quyền của chính tôi **[NEW]**

`GET /v1/tenants/:tenantId/me/permissions` (auth + tenant context, không cần thêm quyền)

Response 200: `{ "codes": ["tenant.read", "member.invite", ...] }`

Dùng để ẩn mục "Mời thành viên" khi thiếu `member.invite` (FR-007). Backend tính từ
membership + role bindings + branch scope (constitution II).

## 5. Tạo lời mời

`POST /v1/tenants/:tenantId/invitations` (auth + tenant context + quyền `member.invite`; **header `idempotency-key` bắt buộc**, 8-128 ký tự)

Request (zod strict):

```json
{
  "type": "DIRECT",
  "roleId": "uuid",
  "branchId": null | "uuid (bỏ qua)",
  "maxUses": 1 (bỏ qua — mặc định 1),
  "expiresAt": "ISO-8601 (bắt buộc, > hiện tại)"
}
```

Response 201: `{ id, type, state, tokenHint, maxUses, useCount, expiresAt, token, inviteUrl }`

- `token` chỉ xuất hiện ở response này; share bằng token.
- Lỗi: 422 `VALIDATION_FAILED` (thiếu/sai idempotency-key, expiresAt quá khứ...), 403 `AUTHORIZATION_DENIED`.

## 6. Nhận lời mời

`POST /v1/invitations/accept` (auth; **header `idempotency-key` bắt buộc**, 8-128 ký tự)

Request (zod strict): `{ "token": "string (20-512)" }`

Response 201: `{ id, tenantId, membershipDisplayName, displayName, status, joinedAt, ... }`

Lỗi:
- 409 `PROFILE_CONFIRMATION_REQUIRED` — "Hãy xác nhận họ tên trước khi tham gia doanh nghiệp." → mobile giữ mã, chuyển xác nhận tên, accept lại (FR-014).
- 410 `RESOURCE_GONE` — "Lời mời không còn hiệu lực." (sai mã/hết hạn/thu hồi/hết lượt).
- 401 khi chưa đăng nhập.

## 7. Xác nhận họ tên (tái dùng)

`PATCH /v1/me` (auth) `{ "fullName": "2-120 ký tự" }` → `{ id, fullName, profileComplete, status }`.
