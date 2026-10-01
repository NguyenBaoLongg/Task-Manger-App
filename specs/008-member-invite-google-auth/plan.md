# Implementation Plan: Mời thành viên & đăng nhập Google (mobile)

**Branch**: `008-member-invite-google-auth` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-member-invite-google-auth/spec.md`

## Summary

Ba màn hình mobile: (1) đăng nhập bằng Google thật (thay nút nội bộ giả lập), (2) "Mời thành
viên" — chọn vai trò, tạo mã dùng một lần hạn 7 ngày, chia sẻ qua share sheet, (3) "Tham gia
công ty" — nhập mã, tự hoàn tất sau khi xác nhận họ tên, làm mới danh sách workspace. Backend
đã có API lời mời/vai trò/auth; **bổ sung duy nhất** là endpoint `GET /v1/tenants/:tenantId/me/permissions`
để app ẩn nút mời đúng theo quyền `member.invite` (nghiên cứu R3 — ngoài giả định "backend đã
đủ", đã báo chủ sản phẩm). Chi tiết quyết định kỹ thuật xem [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript (strict), React Native 0.81 / Expo SDK 53

**Primary Dependencies**: expo-router 5 (file routing), expo-auth-session (~6.2) + expo-web-browser
(~14.x) cho Google OAuth (mới cài), react-native `Share` (có sẵn), @testing-library/react-native
+ jest-expo cho test; backend Express 5 + zod (không đổi ngoài 1 route).

**Storage**: Không thêm bảng — PostgreSQL/Prisma hiện hữu; state client chỉ giữ trong phiên
(mã lời mời đang nhập, token join flow).

**Testing**: jest (unit/integration/a11y), contract test bằng jest + fetch mock (pattern
`tests/integration` hiện hữu), Detox E2E trên LDPlayer (build `releaseE2e`, `-w 1`, 7 suite tường minh).

**Target Platform**: Android (API 34, LDPlayer/máy thật) — iOS không nằm trong phạm vi kiểm chứng.

**Project Type**: mobile app (React Native) + 1 route backend.

**Performance Goals**: Màn hình đăng nhập tương tác được < 3s; tạo lời mời phản hồi < 5s (SC-001/SC-002, CR-005).

**Constraints**: Không commit secret (Google client ID qua env lúc build); test tự động không
cần Google thật (constitution VI); giữ nguyên 7 suite E2E hiện hữu; không đổi hợp đồng API đang dùng.

**Scale/Scope**: 3 màn hình mới + 2 model flow + 1 route backend; không thêm dependency native ngoài expo-auth-session/web-browser.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [X] **Tenant isolation**: mọi lời mời/vai trò đi qua route tenant-scoped (`/tenants/:tenantId/...`)
      với `tenantContext` từ membership; endpoint [NEW] `me/permissions` cũng tenant-scoped. Test
      negative cross-tenant trong contract test.
- [X] **Identity/authority ở backend**: đăng nhập Google chỉ cung cấp identity; quyền mời do
      backend kiểm tra (`member.invite`), việc ẩn UI chỉ là trải nghiệm — 403 vẫn là chốt cuối.
      Không hard-code admin id nào.
- [X] **Lịch sử & idempotency**: tạo/nhận lời mời dùng idempotency (header bắt buộc khi accept,
      tenantIdempotent khi tạo); membership ghi audit ở backend hiện hữu; `expiresAt` là chính
      sách đầu vào (7 ngày) do client gửi nhưng backend xác nhận lại.
- [X] **Contracts trước consumer**: [contracts/api.md](./contracts/api.md) ghi đúng hợp đồng hiện
      hữu (đọc từ code route/zod) + endpoint [NEW]; Google OAuth qua interface `GoogleProvider` có
      test double — không đụng provider thật trong test.
- [X] **Quality gates**: ánh xạ kiểm thử theo CR-006 — unit (model flows), contract (4 API + [NEW]),
      integration (mời→accept→thấy workspace), a11y (3 màn hình), E2E (join flow + ma trận 7 suite
      không regression); typecheck/lint/build bắt buộc.
- [X] **Vận hành & privacy**: mã lời mời không log; không lưu secret; Google client ID qua env;
      test local không cần credential ngoài (constitution VI).

## Project Structure

### Documentation (this feature)

```text
specs/008-member-invite-google-auth/
├── plan.md              # File này
├── research.md          # R1-R9 quyết định kỹ thuật
├── data-model.md        # Entity + client state + state transitions
├── quickstart.md        # Kịch bản kiểm chứng
├── contracts/
│   └── api.md           # Hợp đồng API (hiện hữu + [NEW] me/permissions)
└── tasks.md             # /speckit-tasks tạo sau
```

### Source Code (repository root)

```text
apps/mobile/
├── app/
│   ├── (auth)/sign-in.tsx               # SỬA: nút Google thật, bỏ nút nội bộ
│   ├── (auth)/workspace-selection.tsx   # SỬA: lối vào "Tham gia công ty" khi rỗng
│   ├── (auth)/profile-confirmation.tsx  # SỬA: nhận pending token → tự accept (FR-014)
│   ├── (auth)/join-company.tsx          # MỚI: nhập mã lời mời
│   └── (tabs)/workspace.tsx             # SỬA: mục "Mời thành viên" (ẩn theo quyền)
├── app/(tabs)/invite-member.tsx         # MỚI: chọn vai trò → tạo mã → chia sẻ
├── src/
│   ├── auth/google-provider.ts          # interface hiện hữu
│   ├── auth/google-auth-session.ts      # MỚI: production provider (expo-auth-session)
│   ├── auth/provider-factory.ts         # MỚI: chọn provider theo build (R2)
│   ├── config/runtime-config.ts         # SỬA: googleClientId
│   ├── features/members/invite-model.ts # MỚI: roles list + create invitation
│   ├── features/members/join-model.ts   # MỚI: accept + refresh tenants
│   └── features/workspace/workspace-queries.ts # SỬA: permissions query (FR-007)
└── tests/
    ├── unit/…, integration/…, accessibility/…, e2e/… # MỚI/SỬA theo CR-006

apps/api/src/modules/rbac/
├── rbac-routes.ts                       # SỬA: + GET /tenants/:tenantId/me/permissions [NEW]
└── rbac-service.ts                      # SỬA: myPermissionCodes(membershipId)
```

**Structure Decision**: Giữ nguyên cấu trúc monorepo hiện hữu — màn hình expo-router trong
`apps/mobile/app/`, model trong `src/features/`, test theo thư mục `tests/` đã có. Endpoint
[NEW] đặt trong module rbac sẵn có (không tạo module mới).

## Complexity Tracking

Không có vi phạm constitution cần biện minh. Ghi chú duy nhất: endpoint `me/permissions` [NEW]
là bổ sung nhỏ ngoài giả định spec "backend đã đủ" — được ghi trong spec Assumptions và đã báo
chủ sản phẩm trước khi implement (R3).
