# Quickstart: Kiểm chứng feature 008

Hướng dẫn chạy các kịch bản kiểm chứng end-to-end. Chi tiết hợp đồng xem
[contracts/api.md](contracts/api.md); model xem [data-model.md](data-model.md).

## Tiền đề

- API chạy: `node --env-file=.env --import tsx apps/api/src/index.ts` (repo root).
- API ở `AUTH_GOOGLE_MODE=fake` để kiểm thử tự động; để đăng nhập Google thật cần
  `AUTH_GOOGLE_MODE=google` + `GOOGLE_CLIENT_ID` (chủ sản phẩm cấu hình).
- Mobile build production cần `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (không commit); thiếu → màn hình
  đăng nhập báo lỗi cấu hình (FR-002).
- Thiết bị kiểm thử: LDPlayer (xem memory project-e2e-off-emulator) hoặc máy thật.

## Kịch bản 1 — Gates tự động (không cần thiết bị)

```bash
cd apps/mobile
npx tsc --noEmit
npx eslint .
npx jest            # unit + integration + accessibility
```

Kỳ vọng: toàn bộ pass; test mới phủ sign-in model, invite model, accept model + 3 màn hình a11y.

## Kịch bản 2 — Hai tài khoản trên 1 máy dev (API fake mode)

1. Tạo tài khoản thứ hai (tự động tạo user khi subject mới):

```bash
curl -X POST http://localhost:3000/v1/auth/google -H "content-type: application/json" \
  -d '{"idToken":"dev-google:tho:tho@adsup.local"}'
```

2. Xác nhận họ tên cho tài khoản mới: `PATCH /v1/me` với accessToken ở trên.
3. Tạo lời mời bằng tài khoản chủ (`dev-google:local-mobile-user:mobile@adsup.local`),
   roleId Nhân viên seed `00000043-0000-4000-8000-000000000003`, `expiresAt` = now + 7 ngày
   (xem contracts mục 5). Lấy `token` từ response.
4. Nhận lời mời bằng accessToken của "tho": `POST /v1/invitations/accept` với header
   `idempotency-key` (xem contracts mục 6). Kỳ vọng 201 + membership mới.
5. `GET /v1/me/tenants` bằng token "tho" → thấy "Công ty TNHH ABC".

## Kịch bản 3 — Trên thiết bị (LDPlayer, build releaseE2e)

Build: `./gradlew :app:assembleReleaseE2e` (giữ test-double auth cho E2E — R2).

1. Mở app → màn hình đăng nhập hiển thị nút "Đăng nhập bằng Google" (bản E2E vẫn dùng
   test double tự động nên bấm là vào luôn).
2. Tab Workspace → với tài khoản chủ thấy mục "Mời thành viên"; với tài khoản nhân viên
   (không có `member.invite`) mục này ẩn (FR-007).
3. Màn hình mời: chọn vai trò → bấm tạo → thấy mã + hạn 7 ngày → bấm "Chia sẻ" → share sheet mở.
4. Tài khoản mới (chưa có công ty): màn hình chọn workspace rỗng hiển thị "Tham gia công ty"
   → nhập mã → nếu chưa có tên thì xác nhận tên → tự hoàn tất → công ty xuất hiện ngay.
5. Nhập mã sai/hết hạn → thông báo tiếng Việt, nhập lại được.
6. Hai thiết bị: máy 1 (chủ) và máy 2 (người được mời) cùng mở Tin nhắn → nhắn qua lại realtime.

## Kịch bản 4 — E2E tự động (Detox, không cần Google thật)

Ma trận 7 suite hiện hữu phải vẫn PASS trên build releaseE2e (test double giữ nguyên hành vi
đăng nhập cũ). Suite mới (nếu thêm cho luồng join) dùng API fake mode để seed lời mời trước
rồi thao tác app bằng test double auth — không đòi credential Google (constitution VI).
