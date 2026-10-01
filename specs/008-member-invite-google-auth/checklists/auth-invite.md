# Requirements Quality Checklist: Mời thành viên & đăng nhập Google (008)

**Purpose**: Kiểm tra chất lượng yêu cầu (completeness, clarity, consistency, coverage) của spec feature 008 — "unit tests cho phần viết yêu cầu", KHÔNG phải kiểm thử chức năng.
**Created**: 2026-09-29
**Feature**: [spec.md](../spec.md)

**Focus areas**: (1) yêu cầu bảo mật/xác thực Google, (2) yêu cầu chất lượng hợp đồng API, (3) yêu cầu UX 3 màn hình. **Depth**: standard. **Audience**: reviewer (PR).

## Requirement Completeness

- [x] CHK001 Are requirements defined for all 3 deliverables (Google sign-in, invite member, join company)? [Completeness, Spec §FR-001..FR-014]
- [x] CHK002 Are error requirements defined for every failure class of the join flow (invalid/expired/exhausted/revoked/profile-not-confirmed/locked/network)? [Completeness, Spec §FR-010, Edge Cases]
- [x] CHK003 Are loading-state requirements defined for asynchronous steps (role list, invitation creation, join submission)? [Completeness, Spec Edge Cases "Mọi bước chờ mạng..."]
- [x] CHK004 Is the logout requirement's entry point defined (where the logout action lives, confirm step)? [Completeness, Spec §FR-013]
- [x] CHK005 Are empty-state requirements defined for the role list? [Completeness, Spec Edge Cases "Danh sách vai trò trống", Assumptions]

## Requirement Clarity

- [x] CHK006 Is the invitation lifetime quantified (exactly 7 days) and its display to the inviter explicit? [Clarity, Spec §FR-012, Clarifications]
- [x] CHK007 Are role-selection rules explicit (exactly one role from the company's role list)? [Clarity, Spec §FR-004, US2/AC1]
- [x] CHK008 Is the invite-entry hiding condition unambiguous (missing `member.invite` permission)? [Clarity, Spec §FR-007, Assumptions R3]
- [x] CHK009 Is the join-entry visibility condition quantified (only when tenant list is empty)? [Clarity, Spec §FR-008, Clarifications]
- [x] CHK010 Are Vietnamese error messages specified per error class (exact wording for invalid invitation, profile confirmation)? [Clarity, Spec §FR-010, Edge Cases, contracts §6]
- [x] CHK011 Is the share content defined (code + short instructions)? [Clarity, Spec §FR-006, US2/AC3]

## Requirement Consistency

- [x] CHK012 Does the idempotency requirement (FR-011) align with both API contracts (create AND accept both require idempotency-key header)? [Consistency, Spec §FR-011, contracts §5 §6]
- [x] CHK013 Is the auto-complete-after-name-confirmation requirement consistent across US3/AC4, FR-014, and Edge Cases? [Consistency, Spec §FR-014]
- [x] CHK014 Is the "backend unchanged" constraint (CR-005) consistent with the single new endpoint recorded in Assumptions? [Consistency, Spec §CR-005, Assumptions]
- [x] CHK015 Does the join entry requirement (FR-008) not conflict with the invite entry in Workspace tab (FR-007)? [Consistency, Spec §FR-007, §FR-008]

## Acceptance Criteria Quality

- [x] CHK016 Are all success criteria measurable and technology-agnostic? [Measurability, Spec SC-001..SC-005]
- [x] CHK017 Is the duplicate-prevention criterion quantified (0 duplicate records in automated tests)? [Measurability, Spec SC-005]
- [x] CHK018 Are acceptance scenarios defined for every user story's primary flow? [Coverage, Spec US1..US3]

## Scenario Coverage

- [x] CHK019 Are alternate flows covered (first-time user, cancel Google account chooser, locked account)? [Coverage, Spec US1/AC2..AC4]
- [x] CHK020 Is the recovery flow specified when the share sheet is unavailable (manual copy)? [Coverage, Spec Edge Cases]
- [x] CHK021 Is the retry-after-network-failure flow specified without duplicate records? [Coverage, Spec US2/AC5, Edge Cases]
- [x] CHK022 Is the recovery flow for unconfirmed profile specified (keep token, auto-complete, no re-entry)? [Coverage, Spec §FR-014, US3/AC4]

## Edge Case Coverage

- [x] CHK023 Are boundary cases addressed (expired/revoked/exhausted code, empty role list, own-company code)? [Coverage, Spec Edge Cases]
- [x] CHK024 Is the edge case "has invite permission but lacks role-read permission" addressed? [Coverage, Spec Edge Cases "thiếu quyền đọc vai trò"]
- [x] CHK025 Is behavior defined when Google OAuth is not configured (FR-002) without blocking dev testing? [Coverage, Spec §FR-002, Assumptions]

## Non-Functional Requirements

- [x] CHK026 Are security/privacy requirements specified (invitation code never logged, code normalization, name rules 2-120)? [Spec CR-004]
- [x] CHK027 Are performance requirements quantified (sign-in interactive <3s, invitation creation <5s)? [Clarity, Spec CR-005]
- [x] CHK028 Are accessibility requirements defined for the 3 screens? [Coverage, Spec CR-006]
- [x] CHK029 Is the test-level traceability requirement specified (unit/contract/integration/a11y/E2E per requirement)? [Traceability, Spec CR-006]

## Dependencies & Assumptions

- [x] CHK030 Are external dependencies documented (Google Cloud OAuth client ID, GOOGLE_CLIENT_ID for API, test doubles for automated tests)? [Dependency, Spec Assumptions]
- [x] CHK031 Are out-of-scope items explicitly bounded (no invite list/revoke, no deep-link handling)? [Completeness, Spec Assumptions]

## Notes

- Check items off as completed: `[x]`
- Các lỗ hổng chất lượng phát hiện khi sinh checklist này đã được vá trực tiếp vào spec.md/contracts (FR-013, CR-005, Assumptions R3, Edge Cases, contract §5 idempotency-key) trước khi đánh dấu hoàn thành.
- Items are numbered sequentially for easy reference
