---

description: "Task list for feature 008: Mời thành viên & đăng nhập Google (mobile)"
---

# Tasks: Mời thành viên & đăng nhập Google (mobile)

**Input**: Design documents from `/specs/008-member-invite-google-auth/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are mandatory under the Adsup Constitution. Every buildable requirement
must include the appropriate unit, contract, integration, tenant-isolation, migration, or
end-to-end verification task before implementation is marked complete.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Mobile: `apps/mobile/app/` (màn hình expo-router), `apps/mobile/src/` (model/service), `apps/mobile/tests/`
- API: `apps/api/src/modules/`, `apps/api/tests/`
- Database package: `packages/database/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies và cấu hình nền cho Google OAuth

- [X] T001 [P] Cài `expo-auth-session` và `expo-web-browser` khớp Expo SDK 53 (`npx expo install expo-auth-session expo-web-browser` trong apps/mobile) — cập nhật apps/mobile/package.json
- [X] T002 [P] Khai báo scheme `adsup` và `extra.googleClientId` từ `EXPO_PUBLIC_GOOGLE_CLIENT_ID` trong apps/mobile/app.config.ts
- [X] T003 [P] Thêm `googleClientId?: string` vào `RuntimeConfig` và đọc từ env/extra trong apps/mobile/src/config/runtime-config.ts (không throw khi thiếu — FR-002 xử lý ở màn hình đăng nhập)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Endpoint backend mới `me/permissions` (R3) + cơ chế subject test double cho E2E — chặn mọi user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Contract test (mobile, viết TRƯỚC — phải FAIL) cho `GET /v1/tenants/:tenantId/me/permissions` trong apps/mobile/tests/contract/member-permissions.contract.test.ts (200 `{ codes: string[] }`, 401 khi chưa auth, 403 khi sai tenant context)
- [X] T005 [P] Thêm cơ chế subject test double cho bản releaseE2e — `findProperty('adsupE2eGoogleSubject')` trong apps/mobile/android/app/build.gradle → BuildConfig `ADSUP_E2E_GOOGLE_SUBJECT` (mặc định `local-mobile-user`); getter trong apps/mobile/src/native/adsup-runtime.ts; `createAuthTestDouble` trong apps/mobile/src/auth/auth-test-double.ts đọc subject từ getter (dùng cho E2E join flow T031 — tài khoản thứ hai)
- [X] T006 Thêm `listEffectivePermissionCodes(tenantId, membershipId)` vào packages/database/src/organization-rbac.repository.ts — join `rolePermission` + `membershipRoleBinding` theo `effectiveFrom/effectiveTo`, trả mã permission distinct đã sắp xếp
- [X] T007 Thêm `myPermissionCodes(tenantId, membershipId)` vào apps/api/src/modules/rbac/rbac-service.ts (gọi method ở T006)
- [X] T008 Thêm route `GET /tenants/:tenantId/me/permissions` (auth + tenantContext, KHÔNG `requirePermission`) trong apps/api/src/modules/rbac/rbac-routes.ts → trả `{ codes: string[] }`
- [X] T009 Backend contract + tenant-isolation test cho endpoint mới trong apps/api/tests/contract/rbac-permissions.contract.test.ts (positive: OWNER thấy `member.invite`; negative cross-tenant: membership tenant A không đọc được quyền tenant B)

**Checkpoint**: Foundation ready — endpoint quyền hoạt động, test contract xanh

---

## Phase 3: User Story 1 - Đăng nhập bằng Google (Priority: P1) 🎯 MVP

**Goal**: Màn hình đăng nhập chỉ có nút "Đăng nhập bằng Google" (bỏ nút nội bộ); tài khoản mới đi qua xác nhận họ tên; hủy chọn tài khoản không lỗi; tài khoản khóa báo lỗi tiếng Việt.

**Independent Test**: Mở app → bấm "Đăng nhập bằng Google" → chọn tài khoản → vào workspace-selection (hoặc profile-confirmation nếu tài khoản mới). Trên build `releaseE2e` vẫn dùng test double nên 7 suite E2E hiện hữu không đổi.

### Tests for User Story 1 (REQUIRED) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T010 [P] [US1] Unit test provider factory + production provider trong apps/mobile/tests/unit/google-auth-session.test.ts (production gọi AuthSession đúng: responseType `id_token`, nonce, scopes `openid email profile`; factory chọn test double khi `getReleaseE2eApiBaseUrl()` khác null; production thiếu `googleClientId` → lỗi cấu hình FR-002)
- [X] T011 [P] [US1] Cập nhật a11y test màn hình đăng nhập trong apps/mobile/tests/accessibility/auth-workspace.a11y.test.tsx (nút "Đăng nhập bằng Google": accessibilityRole button, label đúng, disabled khi busy)

### Implementation for User Story 1

- [X] T012 [P] [US1] Tạo apps/mobile/src/auth/google-auth-session.ts — production `GoogleProvider` dùng expo-auth-session (`responseType: 'id_token'`, `nonce`, scopes, redirectUri `<scheme>:/oauthredirect`), trả `GoogleAuthResult`
- [X] T013 [US1] Tạo apps/mobile/src/auth/provider-factory.ts — chọn provider: releaseE2e → `createAuthTestDouble()`; production → google-auth-session; production thiếu client ID → ném lỗi cấu hình rõ ràng (FR-002) (depends on T012)
- [X] T014 [US1] Sửa apps/mobile/app/(auth)/sign-in.tsx — nút "Đăng nhập bằng Google" thay "Đăng nhập nội bộ" (FR-001), dùng provider-factory, hủy chọn tài khoản → ở lại màn hình không lỗi (US1-AC3), 403 → "Tài khoản đã bị khóa." (US1-AC4), giữ điều hướng profileComplete → workspace-selection / profile-confirmation (depends on T013)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Mời thành viên (Priority: P2)

**Goal**: Người có quyền `member.invite` mở tab Workspace → "Mời thành viên" → chọn đúng 1 vai trò → tạo mã hạn 7 ngày → xem mã + chia sẻ qua share sheet. Thành viên không có quyền không thấy mục này.

**Independent Test**: Đăng nhập tài khoản OWNER (seed) → tab Workspace thấy "Mời thành viên" → chọn vai trò EMPLOYEE → tạo → thấy mã + hạn → bấm chia sẻ mở share sheet. Đăng nhập tài khoản không có quyền mời → không thấy mục này.

### Tests for User Story 2 (REQUIRED) ⚠️

- [X] T015 [P] [US2] Unit test invite-model trong apps/mobile/tests/unit/invite-model.test.ts (expiresAt = now + 7 ngày, idempotency-key mới mỗi lần tạo, parse InvitationResult token/tokenHint/expiresAt, buildSharePayload gồm mã + hướng dẫn)
- [X] T016 [P] [US2] Contract test mời + vai trò trong apps/mobile/tests/contract/member-invite.contract.test.ts (GET roles shape + 403 thiếu `role.read`; POST invitations bắt buộc header idempotency-key, 422 expiresAt quá khứ, 403 thiếu `member.invite`)
- [X] T017 [P] [US2] Integration test luồng mời trong apps/mobile/tests/integration/member-invite.integration.test.ts (chọn vai trò → tạo → hiển thị mã; lỗi mạng → thử lại không tạo bản ghi trùng nhờ idempotency key — US2-AC5)
- [X] T018 [P] [US2] A11y test màn hình mời + tab Workspace trong apps/mobile/tests/accessibility/member-invite.a11y.test.tsx (bao gồm Alert xác nhận đăng xuất — FR-013)

### Implementation for User Story 2

- [X] T019 [P] [US2] Tạo apps/mobile/src/features/members/invite-model.ts — `listInviteRoles`, `createInvitation` (type DIRECT, expiresAt now+7d, header idempotency-key, parse token/tokenHint/expiresAt), `buildSharePayload`
- [X] T020 [P] [US2] Thêm `myPermissions(client, tenantId)` vào apps/mobile/src/features/workspace/workspace-queries.ts — gọi `/tenants/:tenantId/me/permissions` (FR-007)
- [X] T021 [US2] Tạo màn hình apps/mobile/app/(tabs)/invite-member.tsx — danh sách vai trò (name + code phụ đề), chọn đúng 1, nút tạo lời mời, hiển thị mã + tokenHint + hạn 7 ngày (FR-012), nút "Chia sẻ" qua `Share.share` (FR-006), loading/empty/error tiếng Việt (danh sách vai trò rỗng → ẩn nút tạo) (depends on T019)
- [X] T022 [US2] Sửa apps/mobile/app/(tabs)/workspace.tsx — mục "Mời thành viên" ẩn khi thiếu `member.invite` (FR-007, dùng `myPermissions` từ T020), route tới `/(tabs)/invite-member`; thêm Alert xác nhận trước khi đăng xuất (FR-013) (depends on T020)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Tham gia công ty (Priority: P3)

**Goal**: Tài khoản chưa thuộc công ty nào thấy "Tham gia công ty" trên màn hình chọn workspace → nhập mã → (nếu chưa có họ tên: xác nhận họ tên rồi tự hoàn tất, không nhập lại mã) → công ty xuất hiện ngay trong danh sách.

**Independent Test**: Tài khoản Google mới (hoặc test double subject mới) → workspace-selection rỗng thấy "Tham gia công ty" → nhập mã hợp lệ → thấy công ty trong danh sách và vào được.

### Tests for User Story 3 (REQUIRED) ⚠️

- [X] T023 [P] [US3] Unit test join-model trong apps/mobile/tests/unit/join-model.test.ts (trim mã trước khi gửi, 409 giữ token trong flow, 410 → "Lời mời không còn hiệu lực.", idempotency-key mới mỗi lần submit)
- [X] T024 [P] [US3] Contract test accept trong apps/mobile/tests/contract/member-join.contract.test.ts (header idempotency-key bắt buộc; 409 PROFILE_CONFIRMATION_REQUIRED; 410 RESOURCE_GONE; 401 chưa đăng nhập)
- [X] T025 [P] [US3] Integration test luồng join trong apps/mobile/tests/integration/member-join.integration.test.ts (nhập mã → 409 → PATCH /v1/me → accept tự động → selectWorkspace refresh có tenant mới — FR-014, FR-009)
- [X] T026 [P] [US3] A11y test join-company + workspace-selection trong apps/mobile/tests/accessibility/member-join.a11y.test.tsx

### Implementation for User Story 3

- [X] T027 [P] [US3] Tạo apps/mobile/src/features/members/join-model.ts — `acceptInvitation` (trim token, idempotency-key, map lỗi 409/410/network sang thông điệp tiếng Việt), `completePendingJoin` (accept lại sau khi xác nhận tên)
- [X] T028 [US3] Tạo màn hình apps/mobile/app/(auth)/join-company.tsx — ô nhập mã, nút "Tham gia", thông báo lỗi tiếng Việt theo từng lớp lỗi và cho nhập lại (FR-010), chặn bấm lặp khi đang gửi (depends on T027)
- [X] T029 [US3] Sửa apps/mobile/app/(auth)/workspace-selection.tsx — lối vào "Tham gia công ty" chỉ hiển thị khi danh sách đã tải xong và rỗng (FR-008), route tới `/(auth)/join-company`
- [X] T030 [US3] Sửa apps/mobile/app/(auth)/profile-confirmation.tsx — nhận mã pending từ join flow (param), sau khi PATCH /v1/me thành công tự gọi accept rồi quay workspace-selection với danh sách làm mới (FR-014, FR-009) (depends on T027)

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: E2E, gates đầy đủ và bằng chứng kiểm chứng

- [X] T031 [P] Tạo E2E luồng tham gia công ty trong apps/mobile/tests/e2e/member-join.e2e.ts — test setup gọi API tạo lời mời trước, login test double với subject thứ hai (BuildConfig `adsupE2eGoogleSubject` từ T005), nhập mã, thấy tenant trong workspace-selection
- [X] T032 Chạy ma trận E2E đầy đủ trên LDPlayer: `-w 1` + liệt kê tường minh toàn bộ file e2e (7 suite cũ + member-join = 8 file, KHÔNG dùng glob — adb thấy 2 mục thiết bị)
- [X] T033 Chạy gates đầy đủ: typecheck + lint + jest (unit/contract/integration/a11y) apps/mobile; test apps/api (contract/integration/unit); build `:app:assembleReleaseE2e`
- [X] T034 Chạy 4 kịch bản quickstart.md trên thiết bị LDPlayer (gates, 2-tài-khoản qua curl, on-device, E2E) — đo SC-001/SC-002/CR-005 (đăng nhập tương tác <3s, tạo lời mời <5s) và ghi bằng chứng
- [X] T035 Ghi specs/008-member-invite-google-auth/verification.md — ánh xạ FR/SC → test đã chạy + bằng chứng (CR-006 traceability)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 (P1) → US2 (P2) → US3 (P3) theo thứ tự ưu tiên; mỗi story độc lập kiểm chứng được
- **Polish (Final Phase)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — MVP
- **User Story 2 (P2)**: Cần US1 hoàn tất (phải đăng nhập mới vào được tab Workspace); cần Foundational (me/permissions)
- **User Story 3 (P3)**: Cần US1 (đăng nhập tài khoản mới) và tái dùng profile-confirmation; độc lập với US2

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Models before screens
- Screens before cross-screen wiring (workspace-selection/profile-confirmation sửa sau khi màn hình mới tồn tại)

### Parallel Opportunities

- T001, T002, T003 chạy song song (Setup)
- T004 (contract test mobile) và T005 (subject test double) độc lập với T006-T009 (backend); T006→T007→T008 tuần tự
- Mọi task test trong mỗi story đánh dấu [P] chạy song song được
- T019/T020 song song; T027 độc lập; T012 độc lập với T019/T020/T027

---

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together:
Task: "Unit test invite-model trong apps/mobile/tests/unit/invite-model.test.ts"
Task: "Contract test mời + vai trò trong apps/mobile/tests/contract/member-invite.contract.test.ts"
Task: "Integration test luồng mời trong apps/mobile/tests/integration/member-invite.integration.test.ts"
Task: "A11y test màn hình mời + tab Workspace trong apps/mobile/tests/accessibility/member-invite.a11y.test.tsx"

# Launch models together:
Task: "Tạo apps/mobile/src/features/members/invite-model.ts"
Task: "Thêm myPermissions vào apps/mobile/src/features/workspace/workspace-queries.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (cài dependency + config client ID)
2. Complete Phase 2: Foundational (endpoint me/permissions + subject test double — CRITICAL, blocks FR-007/T031)
3. Complete Phase 3: User Story 1 (đăng nhập Google)
4. **STOP and VALIDATE**: test độc lập US1, chạy lại 7 suite E2E không regression
5. Build releaseE2e kiểm tra trên LDPlayer

### Incremental Delivery

1. Setup + Foundational → endpoint quyền xanh contract test
2. US1 → đăng nhập Google hoạt động (MVP) → validate độc lập
3. US2 → mời thành viên hoạt động → validate độc lập
4. US3 → tham gia công ty hoạt động → validate độc lập
5. Polish → ma trận E2E 8 suite + gates + quickstart + verification.md

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Không commit secret: Google client ID chỉ qua env lúc build (`EXPO_PUBLIC_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_ID` phía API do chủ sản phẩm điền)
- Build `releaseE2e` giữ test double đăng nhập (R2) — KHÔNG đổi hành vi 7 suite E2E hiện hữu; subject test double đổi được qua gradle property `adsupE2eGoogleSubject`
- Mã lời mời không được log (CR-004)
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
