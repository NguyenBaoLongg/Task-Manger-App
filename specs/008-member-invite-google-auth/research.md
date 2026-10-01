# Research: Mời thành viên & đăng nhập Google (mobile)

## R1 — Cách lấy Google ID token trên mobile

- **Decision**: Dùng `expo-auth-session` + `expo-web-browser` (Expo SDK 53), luồng authorization request tới Google OAuth với `responseType: 'id_token'`, tham số `nonce` (Google bắt buộc cho id_token), scopes `openid email profile`. Client OAuth phải là kiểu **Web application** trong Google Cloud, redirect URI đăng ký theo scheme của app (`<scheme>:/oauthredirect` với scheme `adsup` trong app.json).
- **Rationale**: Backend `ProductionGoogleVerifier` xác minh bằng `verifyIdToken({ idToken, audience: clientId })` — nó cần **ID token**, không phải access token hay authorization code. `responseType: 'id_token'` trả về đúng thứ backend cần, không cần đổi backend. Bọc sau interface `GoogleProvider` đã có (`apps/mobile/src/auth/google-provider.ts`) nên kiểm thử dùng test double không đụng mạng Google.
- **Alternatives considered**: `@react-native-google-signin/google-signin` (native module, cần google-services.json + Google Play services, khó mock và nặng hơn khi build — loại); authorization code + PKCE (backend không có endpoint đổi code, phải sửa backend — loại vì spec nói backend đã đủ).

## R2 — Chọn provider đăng nhập theo môi trường (FR-001 vs kiểm thử)

- **Decision**: Build `releaseE2e` (bản nhúng bundle dùng cho Detox, nhận biết qua `getReleaseE2eApiBaseUrl()` khác null — pattern native đã có) giữ **test double** provider (idToken `dev-google:...`, không cần Google thật, giữ nguyên 7 suite E2E hiện hữu). Build production dùng **Google thật**. Khi build production mà thiếu `EXPO_PUBLIC_GOOGLE_CLIENT_ID` → màn hình đăng nhập hiển thị lỗi cấu hình rõ ràng (FR-002), không treo.
- **Rationale**: Constitution VI — kiểm thử tự động không đòi hỏi credential Google thật; FR-001 chỉ nói bỏ **nút** đăng nhập nội bộ trên app thật, không cấm test bypass tự động trong bản E2E.
- **Alternatives considered**: Bỏ hẳn test double → 7 suite E2E hiện hữu chết, vi phạm constitution V (regression). Giữ nút nội bộ trên app thật → trái FR-001 và quyết định của chủ sản phẩm.

## R3 — Làm sao biết người dùng có quyền mời (FR-007)

- **Finding**: Backend **không có** endpoint trả về bộ quyền của chính người dùng (`GET /me/permissions` không tồn tại; chỉ có middleware kiểm tra từng quyền). Dùng `role.read` (danh sách vai trò) làm proxy không chính xác với vai trò tự tạo.
- **Decision**: Bổ sung endpoint nhỏ phía backend: `GET /v1/tenants/:tenantId/me/permissions` (auth + tenantContext, không cần thêm quyền) trả `{ codes: string[] }` — app ẩn mục "Mời thành viên" khi thiếu `member.invite`. Đây là **thay đổi backend nhỏ ngoài giả định "backend đã đủ"** trong spec — được ghi nhận và báo chủ sản phẩm trước khi implement.
- **Rationale**: Constitution II — quyền phải do backend quyết định từ membership, client không tự suy đoán.

## R4 — Tạo lời mời (hợp đồng API hiện hữu)

- **Decision**: Client gửi `type: 'DIRECT'`, `roleId` (chọn 1 từ danh sách vai trò), `expiresAt` = thời điểm tạo + 7 ngày (FR-012), bỏ qua `branchId`/`maxUses` (mặc định backend 1 lượt). Hiển thị mã trả về (`token`) + `tokenHint` cho người tạo.
- **Rationale**: Hợp đồng API bắt client gửi `expiresAt` (zod `z.coerce.date()`), backend chỉ kiểm tra > hiện tại. Hạn 7 ngày là chính sách đầu vào, không phải timestamp audit nên client tính là đúng tinh thần constitution III.

## R5 — Nhận lời mời & luồng xác nhận tên (FR-014)

- **Decision**: `POST /v1/invitations/accept` với header `idempotency-key` (bắt buộc, min 8 ký tự — sinh UUID). Khi nhận 409 `PROFILE_CONFIRMATION_REQUIRED`: giữ mã trong state luồng, chuyển sang màn hình xác nhận họ tên, sau khi `PATCH /v1/me` thành công thì **tự động gọi accept lại** rồi quay về chọn workspace (tự làm mới danh sách — FR-009). Lỗi 410 → "Lời mời không còn hiệu lực."; lỗi khác → thông điệp tiếng Việt chung (FR-010).
- **Rationale**: Đúng quyết định clarify "tự hoàn tất sau khi xác nhận tên"; idempotency-key chống bấm lặp tạo membership trùng (constitution III).

## R6 — Chia sẻ mã (FR-006)

- **Decision**: Dùng `Share.share` của React Native (share sheet hệ điều hành) với nội dung: tên công ty + mã lời mời + hướng dẫn tải app và vào "Tham gia công ty". Không dùng deep link (backend trả `inviteUrl` `/join?token=...` nhưng mobile chưa có màn hình xử lý link — ngoài phạm vi).
- **Rationale**: Không thêm dependency; share sheet là cách người dùng quen (Zalo/Messenger/SMS).

## R7 — Vị trí lối vào "Tham gia công ty" (FR-008)

- **Decision**: Trên màn hình chọn workspace (`app/(auth)/workspace-selection.tsx`), chỉ hiển thị khi danh sách đã tải xong và rỗng. Bấm vào → màn hình nhập mã `app/(auth)/join-company.tsx`.
- **Rationale**: Đúng quyết định clarify; người đã có công ty không bị làm phiền.

## R8 — Danh sách vai trò

- **Decision**: `GET /v1/tenants/:tenantId/roles` (quyền `role.read`) trả mảng `{ id, name, code, kind, permissionCodes[], ... }`. Màn hình mời hiển thị `name` (+ `code` làm phụ đề), chọn đúng 1; danh sách rỗng → ẩn nút tạo, thông báo.
- **Rationale**: Hợp đồng đã có sẵn; không cần thêm trường.

## R9 — Cấu hình Google cho mobile

- **Decision**: `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (env lúc build) → `app.config.ts` `extra.googleClientId` → runtime config. API cần `AUTH_GOOGLE_MODE=google` + `GOOGLE_CLIENT_ID` (cùng client ID) trong .env của API — chủ sản phẩm tự điền, không commit secret.
- **Rationale**: Constitution IV — secret ngoài source control; pattern `EXPO_PUBLIC_API_BASE_URL` đã có sẵn để bắt chước.
