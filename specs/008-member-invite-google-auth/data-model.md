# Data Model: Mời thành viên & đăng nhập Google (mobile)

Feature này **không thêm bảng mới** phía backend — tái dùng các entity đã có (Invitation,
TenantMembership, Role, ExternalIdentity). Tài liệu này mô tả model phía client (state/flow)
và entity backend mà client chạm tới.

## Entity backend (đã tồn tại — tham chiếu)

- **Invitation (Lời mời)**: `id`, `token` (chỉ trả khi tạo, hash phía server), `tokenHint`
  (6 ký tự cuối), `type` (DIRECT/GROUP_LINK), `roleId`, `maxUses` (mặc định 1), `useCount`,
  `expiresAt`, `revokedAt`, trạng thái suy ra: ACTIVE / EXPIRED / EXHAUSTED / REVOKED.
- **TenantMembership**: `id`, `tenantId`, `userId`, `membershipDisplayName`, `status`,
  `joinedAt` — tạo mới khi accept lời mời.
- **Role**: `id`, `name`, `code`, `kind`, `permissionCodes[]` — nguồn cho picker vai trò.
- **ExternalIdentity**: liên kết Google (`provider=GOOGLE`, `providerSubject`) ↔ user;
  `loginWithGoogle` tự tạo user khi subject mới.

## Model phía client

### GoogleIdentity

| Field     | Kiểu    | Ghi chú                              |
|-----------|---------|--------------------------------------|
| idToken   | string  | Kết quả `responseType=id_token`      |

### InviteRole (màn hình mời)

| Field          | Kiểu     | Nguồn            |
|----------------|----------|------------------|
| id             | uuid     | API roles        |
| name           | string   | API roles        |
| code           | string   | API roles        |
| permissionCodes| string[] | API roles        |

### InvitationDraft (form tạo lời mời)

| Field        | Kiểu    | Ghi chú                              |
|--------------|---------|--------------------------------------|
| roleId       | uuid    | bắt buộc, chọn 1                     |
| type         | 'DIRECT'| cố định                               |
| expiresAt    | ISO8601 | now + 7 ngày (client tính)           |

### InvitationResult (sau khi tạo)

| Field     | Kiểu    | Ghi chú                        |
|-----------|---------|--------------------------------|
| token     | string  | mã đầy đủ — nguồn cho Share    |
| tokenHint | string  | 6 ký tự cuối                   |
| expiresAt | ISO8601 | hiển thị hạn cho người tạo     |

### JoinFlow (luồng tham gia công ty)

| Field  | Kiểu   | Ghi chú                                      |
|--------|--------|----------------------------------------------|
| token  | string | mã nhập vào, giữ qua bước xác nhận họ tên (FR-014) |

## State transitions (luồng Join)

```text
idle --nhập mã--> validating --mã hợp lệ--> joined --> workspace list refreshed
                          |-- 409 PROFILE_CONFIRMATION_REQUIRED --> confirming-name --PATCH /me OK--> accept tự động --> joined
                          |-- 410 / mã sai --> invalid (nhập lại)
                          |-- lỗi mạng --> network-error (thử lại, idempotent)
```

## Quy tắc validation

- Mã lời mời: chuẩn hóa `trim()` trước khi gửi; không log mã.
- Họ tên: quy tắc hiện có (2–120 ký tự, chuẩn hóa khoảng trắng) — `validateProfileName` tái dùng.
- `expiresAt` gửi lên phải > hiện tại (backend kiểm tra lại — authoritative).
