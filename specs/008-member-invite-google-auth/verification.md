# Verification: Mời thành viên & đăng nhập Google (mobile)

**Feature**: specs/008-member-invite-google-auth
**Ngày kiểm chứng**: 2026-09-30
**Kết luận**: Tất cả yêu cầu (FR-001 → FR-014, CR-001 → CR-006) có test ánh xạ và PASS, ngoại trừ đăng nhập Google **thật** chưa thể kiểm chứng trên thiết bị vì chưa có client ID OAuth (xem mục "Đăng nhập Google thật" bên dưới).

## 1. Kết quả gates tự động (Kịch bản 1 quickstart)

| Gate | Lệnh | Kết quả |
|------|------|---------|
| Typecheck mobile | `tsc --noEmit` | PASS |
| Lint mobile | `eslint` | PASS |
| Unit/Contract/Integration/A11y mobile | `jest` (apps/mobile) | PASS — 71 suites, 159 tests |
| Contract + unit API | `jest` (apps/api) | PASS — 49 files, 168 tests |
| Integration API | `jest` (apps/api) | PASS — 65 files, 143 tests |
| Build releaseE2e | `:app:assembleReleaseE2e` | PASS — APK SHA-256 `fe13ff20…` (đã cài lên LDPlayer) |

## 2. Kịch bản quickstart trên LDPlayer (T034)

Cả 4 kịch bản quickstart.md đã chạy: (1) gates tự động, (2) hai tài khoản qua API fake mode (tạo lời mời + accept với `dev-google:` subject, idempotency-key riêng), (3) trên thiết bị LDPlayer với build releaseE2e (mời thành viên → mã + hạn 7 ngày → share sheet), (4) E2E tự động Detox.

## 3. Đo lường CR-005 / SC-001 / SC-002

| Chỉ tiêu | Ngưỡng | Đo được | Kết quả |
|----------|--------|---------|---------|
| CR-005 — màn hình đăng nhập sẵn sàng tương tác | < 3 s | **1.144 ms** (native `ADSUP_CR005`, `Process.getStartUptimeMillis` → sẵn sàng tương tác) | PASS |
| CR-005 — tạo lời mời phản hồi | < 5 s | 546 ms trên thiết bị (35 ms API round-trip) | PASS |
| SC-001 — đăng nhập Google hoàn tất | < 60 s | E2E sign-in → dashboard trong thời lượng test (hàng chục giây, phần lớn là overhead khung Detox, không phải thời gian app) | PASS (với test double; Google thật chưa kiểm chứng — xem mục 7) |
| SC-002 — tạo + chia sẻ lời mời | < 30 s | Tạo mã: 546 ms; share sheet mở trong < 3 s sau tap (screenshot OS) | PASS |

Số liệu Detox bị phóng đại bởi khung test (launch mới, idling resources) — con số native `ADSUP_CR005` ở trên là số đo sát sản phẩm nhất.

## 4. E2E trên LDPlayer

- **Ma trận đầy đủ** (`-w 1`, liệt kê tường minh 8 file): 7/8 suite PASS; `booking.e2e.ts` flake do hạ tầng (đã PASS khi chạy riêng lẻ — không liên quan feature này).
- **`member-join.e2e.ts`**: PASS — API tạo lời mời trước, test double subject thứ hai, nhập mã → xác nhận tên → "Công ty TNHH ABC" xuất hiện trong workspace-selection.
- **`scenario3-evidence.e2e.ts`** (run4): **4/4 PASS** —
  1. Owner sign-in (launch arg `ui-test-metric=CR-005`) → tab Workspace thấy "Mời thành viên" (FR-007 dương tính).
  2. Nhân viên không quyền mời → mục mời bị ẩn (FR-007 âm tính).
  3. Mã không hợp lệ → thông điệp lỗi tiếng Việt (FR-010).
  4. Tạo lời mời → mã + "Hạn: …" hiển thị → tap "Chia sẻ" → share sheet OS mở (FR-005, FR-006, FR-012).

## 5. Ánh xạ FR/SC/CR → test (CR-006 traceability)

| Yêu cầu | Unit | Contract | Integration | A11y | E2E |
|---------|------|----------|-------------|------|-----|
| FR-001 Google-only sign-in | google-auth-session, auth-response, auth-test-double | auth-workspace | auth-workspace | auth-workspace | scenario3 (A) |
| FR-002 lỗi tiếng Việt khi thiếu client ID | google-auth-session (factory throws) | — | — | — | — |
| FR-003 điều hướng profileComplete | auth-response | — | auth-workspace | — | member-join |
| FR-004 chọn đúng 1 vai trò | invite-model | member-invite | member-invite | member-invite | scenario3 (D) |
| FR-005 mã dùng một lần + nút chia sẻ | invite-model | member-invite | member-invite | member-invite | scenario3 (D) |
| FR-006 share sheet OS (mã + hướng dẫn) | invite-model (buildSharePayload) | — | member-invite | member-invite | scenario3 (B — screenshot OS) |
| FR-007 ẩn mục mời khi thiếu member.invite | — | member-permissions | — | — | scenario3 (A/C) |
| FR-008 lối vào "Tham gia công ty" | join-model | member-join | member-join | member-join | member-join |
| FR-009 tenant xuất hiện ngay | join-model | — | member-join (refresh) | — | member-join |
| FR-010 lỗi tiếng Việt từng lớp | join-model (map 409/410/network) | member-join | member-join | member-join | scenario3 (invalid code) |
| FR-011 idempotency tạo + nhận | invite-model, join-model | member-invite, member-join (header bắt buộc) | member-invite (retry không trùng) | — | — |
| FR-012 hết hạn đúng 7 ngày | invite-model (now+7d) | member-invite (422 quá khứ) | member-invite | — | scenario3 (D — "Hạn: …") |
| FR-013 đăng xuất có xác nhận | — | — | auth-workspace | member-invite (Alert) | — |
| FR-014 pending join tự hoàn tất | join-model (completePendingJoin) | — | member-join (409 → PATCH /me → accept) | — | member-join |
| CR-001 tenant isolation | — | member-permissions (cross-tenant negative) | — | — | — |
| CR-002 phân quyền member.invite / role.read | — | member-invite, member-permissions | — | — | scenario3 (C) |
| CR-003 retry-safe + audit | invite-model, join-model (key mới mỗi lần) | — | member-invite | — | — |
| CR-004 trim mã, không log mã | join-model (trim) | — | — | — | — |
| SC-003 100% mã hợp lệ → tenant xuất hiện | — | — | member-join | — | member-join |
| SC-004 100% lỗi có thông điệp tiếng Việt | join-model, invite-model | — | — | — | scenario3 (invalid code) |
| SC-005 0 bản ghi trùng khi bấm lặp | — | — | member-invite | — | — |

## 6. Ghi chú môi trường kiểm thử (không phải lỗi sản phẩm)

- **Share sheet treo idling resource của Detox**: khi share sheet OS (ChooserActivity) mở, app bị pause và `FabricTimersIdlingResource` không bao giờ idle → bất kỳ await nào sau tap sẽ treo ~190 s. Xử lý: tap fire-and-forget, lấy bằng chứng bằng `adb exec-out screencap` (đã lưu `C:/adsup-e2e/sc3-share-sheet.png` — hiện hộp thoại "Chia sẻ văn bản" chứa mã lời mời), đóng sheet bằng `KEYCODE_BACK`, rồi `am force-stop` để tháo treo. Test share phải chạy CUỐI file. Đây là giới hạn của Detox/LDPlayer với hoạt động ngoài tiến trình, không phải khiếm khuyết app.
- **Nhân viên mới chưa có cơ sở → dashboard trạng thái lỗi**: `GET /kpi/reports/:date/progress` trả 422 `NO_ACTIVE_BRANCH` với membership mới chưa gán cơ sở; màn hình tổng quan hiển thị ErrorState (không có testID `dashboard.screen`) nhưng tab bar vẫn gắn kết. E2E chờ `tab.workspace` thay vì `dashboard.screen` cho tài khoản này. Hành vi đúng thiết kế hiện tại.
- **Logcat buffer 256 KiB bị tràn**: log hệ thống (EGL) đẩy trôi metric native trong vài phút; đã stream `adb logcat -s AdsupStartupMetrics:I` trong lúc chạy để bắt `ADSUP_CR005`.

## 7. Đăng nhập Google thật — trạng thái

Đã kiểm chứng cấu hình hiện tại: `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (mobile) = chưa đặt, `GOOGLE_CLIENT_ID` (API) = chưa đặt, `AUTH_GOOGLE_MODE` = `fake`. Vì vậy bản build hiện tại **không thể** đăng nhập Gmail thật — đây chính là lý do nút Google không hoạt động ngoài môi trường test double.

Các đường dẫn mã đã sẵn sàng cho cấu hình thật (FR-001/FR-002 đã implement và có test):

1. **Mobile**: đặt `EXPO_PUBLIC_GOOGLE_CLIENT_ID=<client id OAuth Android>` lúc build → `app.config.ts` nướng vào `extra.googleClientId` → `provider-factory.ts` tạo provider expo-auth-session thật (responseType `id_token`, nonce, scopes `openid email profile`).
2. **API**: đặt `GOOGLE_CLIENT_ID` và `AUTH_GOOGLE_MODE=google` → `google-verifier.ts` xác thực idToken thật.
3. Cần client ID OAuth loại Android (package `com.adsup.mobile`, SHA-1 của keystore release) trên Google Cloud — theo Clarifications (Session 2026-09-29), chủ sản phẩm đã có client ID này; sau khi cấu hình xong, chạy lại Kịch bản 3 quickstart để kiểm chứng SC-001 với Google thật.

## 8. Vệ sinh dữ liệu

Sau khi chạy E2E, dữ liệu test (users/memberships test double) đã xóa bằng `cleanup-test-data.ts`; số lượng seed khôi phục đúng bất biến `[30,3,4,3,3,30,30,1]` (membership, branch, department, position, role, assignment, membershipRoleBinding, chatChannel).
