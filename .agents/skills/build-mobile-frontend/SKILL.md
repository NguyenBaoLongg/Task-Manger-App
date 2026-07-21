---
name: build-mobile-frontend
description: "Design, implement, and test a native mobile SaaS frontend in React Native or Flutter for OKR dashboards, workspace tools, video attendance, schema-driven dynamic forms, booking calendars, realtime tenant chat, notification badges, and lock-screen quick actions. Use when scaffolding the mobile app, building these screens or reusable components, integrating backend APIs, or reviewing mobile UX and accessibility."
---

# Build Mobile SaaS Frontend

Read [the mobile frontend requirements](references/Skill_05_Frontend_Mobile.md) before planning or implementation. Require stable backend contracts for the module being integrated.

## Workflow

1. Inspect the repository and current mobile stack. Preserve Flutter or React Native when present. For a new project, default to React Native with TypeScript and Expo unless native capabilities or user constraints require another choice.
2. Use `$ui-ux-pro-max` to generate the design direction and `$design-system` for tokens and component specifications before broad UI implementation.
3. Define bottom navigation for OKR/Dashboard, Workspace, and Chat with accessible labels and deep-linkable routes.
4. Build reusable API, authentication, tenant-context, error, loading, offline-safe, and websocket layers.
5. Render dynamic forms from versioned backend schemas with client validation that mirrors but does not replace server validation.
6. Integrate native video capture and upload with permission, retry, progress, cancellation, and background constraints.
7. Build the booking calendar and status actions from stable booking APIs.
8. Implement tenant-scoped realtime chat with reconnection, pagination, optimistic-state reconciliation, and unread counts.
9. Implement notification badges for photo debt and pending approvals. Implement supported FCM/APNs quick actions for `Đã đến` and `Hủy/Rời lịch`, with authenticated idempotent backend commands.
10. Test small and large screens, light and dark modes, reduced motion, dynamic text, screen readers, touch targets, intermittent networking, and notification action retries.

## Boundaries

- Do not store authoritative business data or authorization state only in local storage.
- Do not expose tenant selection as an unvalidated API scope.
- Do not invent backend fields; update or clarify the API contract first.
- Do not block the main UI thread with media processing.
- Treat lock-screen actions as platform-specific and provide graceful fallbacks.

## Completion

Report navigation, components, design tokens, API contracts, native permissions, platform differences, accessibility results, tests, and remaining backend dependencies.
