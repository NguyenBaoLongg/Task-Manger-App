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

## Graphify

Graphify được cài project-local để tạo knowledge graph tra cứu cấu trúc app.

```powershell
& .\.tools\setup-graphify.ps1
corepack pnpm graphify:build
corepack pnpm graphify -- god-nodes --top 10
```

File sinh ra nằm trong `graphify-out/` và đã được Git ignore. Mở
`graphify-out/graph.html` hoặc `graphify-out/GRAPH_TREE.html` bằng trình duyệt để xem cấu trúc.
