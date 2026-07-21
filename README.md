# Adsup

Adsup là SaaS mobile-first đa tenant cho doanh nghiệp thẩm mỹ. Module 1 cung cấp backend
TypeScript/Express/PostgreSQL/Prisma: Google login + xác nhận họ tên, tenant/invite, tổ chức,
RBAC, biểu mẫu động, chat realtime, push endpoint, media ký URL và audit.

## Chạy local

```powershell
Copy-Item .env.example .env
corepack pnpm install
corepack pnpm db:dev
corepack pnpm db:generate
corepack pnpm db:migrate:deploy
corepack pnpm db:seed
corepack pnpm dev:api
```

Các quality gate: `format:check`, `lint`, `typecheck`, `test`, `test:contract`,
`test:integration`, `test:migration`, `build`, `load:smoke`. Xem acceptance path tại
`specs/001-multitenant-foundation/quickstart.md` và kiến trúc trong `docs/architecture/`.
