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

## Module 4 booking and export

Module 4 provides tenant/branch-scoped customers, dynamic booking forms, one-hour conflict prevention, ARRIVED/photo debt, versioned cancellation reasons and outcomes, scheduled PostgreSQL reports, native XLSX export, and retention tombstones/legal holds. There is no mobile UI or PDF runtime dependency in this module.

Local PostgreSQL gate:

```powershell
$env:DATABASE_URL = "postgresql://postgres:<local-password>@localhost:5432/adsup"
corepack pnpm db:generate
corepack pnpm db:migrate:deploy
corepack pnpm db:seed
corepack pnpm --filter @adsup/database prisma:verify-booking-seed
```

Run `corepack pnpm dev:api` and `corepack pnpm dev:worker` in separate terminals. Local exports and retention use the local adapter; production can set `OBJECT_STORAGE_DRIVER=s3` and the S3-compatible variables from `.env.example`. Local tests do not require cloud credentials.

Before a migration, stop mutation workers and create a custom-format backup with `pg_dump -Fc`. Restore into a new database with `pg_restore`, deploy migrations, verify tenant counts/audit continuity, and run negative tenant-isolation smoke tests before switching traffic.
