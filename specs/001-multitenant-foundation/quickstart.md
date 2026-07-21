# Quickstart Validation: Module 1

This guide is the executable acceptance path for the multi-tenant foundation. It intentionally
uses local providers and does not require AWS, Redis, FCM, APNs or real Google credentials.

## 1. Prerequisites

- Node.js 24 LTS.
- Corepack enabled.
- Free local ports 3000 and the ports printed by `prisma dev`.
- PowerShell 7+ recommended on Windows.

The current machine does not have Docker/PostgreSQL. Prisma local Postgres is therefore the
default. Docker Compose may be added later as an equivalent option, not a requirement.

## 2. Keep package-manager state inside the workspace

```powershell
$env:XDG_CONFIG_HOME = "$PWD\.cache\xdg"
$env:PNPM_HOME = "$PWD\.cache\pnpm-home"
corepack pnpm install
```

This avoids writing user-level pnpm config during sandboxed/local validation.

## 3. Configure local adapters

```powershell
Copy-Item -LiteralPath '.env.example' -Destination '.env' -ErrorAction Stop
```

Expected local defaults:

- `AUTH_GOOGLE_MODE=fake`
- `OBJECT_STORAGE_DRIVER=memory`
- `PUSH_DRIVER=noop`
- `REALTIME_BACKPLANE=memory`
- no production secret or cloud credential in `.env.example`

## 4. Start local PostgreSQL and apply migrations

In terminal A:

```powershell
corepack pnpm db:dev
```

The command starts a named local Prisma Postgres instance and writes/prints a local
`DATABASE_URL`. In terminal B:

```powershell
corepack pnpm db:generate
corepack pnpm db:migrate:deploy
corepack pnpm db:seed
corepack pnpm db:seed
corepack pnpm db:seed
```

Expected: all migrations apply, and three seed runs keep exactly one “Công ty TNHH ABC”
tenant with the deterministic Module 1 organization/membership counts.

## 5. Run all automated gates

```powershell
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:integration
corepack pnpm test:contract
corepack pnpm build
```

Expected: every command exits zero. Integration tests include negative cross-tenant access,
last-owner, invite concurrency/idempotency, form version history, media completion and audit.

## 6. Start the API

```powershell
corepack pnpm dev:api
```

Validate health:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/health/live'
Invoke-RestMethod -Uri 'http://localhost:3000/health/ready'
```

Expected: `status = ok`; dependency output contains no credential or connection string.

## 7. End-to-end onboarding and tenant creation

Fake Google tokens are enabled only in local/test mode and use the format
`dev-google:<stable-subject>:<email>`.

```powershell
$headers = @{ 'Idempotency-Key' = 'login-demo-0001' }
$auth = Invoke-RestMethod -Method Post `
  -Uri 'http://localhost:3000/v1/auth/google' `
  -Headers $headers `
  -ContentType 'application/json' `
  -Body (@{ idToken = 'dev-google:owner-001:owner@example.test' } | ConvertTo-Json)

$bearer = @{ Authorization = "Bearer $($auth.accessToken)" }

$profile = Invoke-RestMethod -Method Patch `
  -Uri 'http://localhost:3000/v1/me' `
  -Headers $bearer `
  -ContentType 'application/json' `
  -Body (@{ fullName = 'Nguyễn Chủ Doanh Nghiệp' } | ConvertTo-Json)

$tenantHeaders = @{
  Authorization = "Bearer $($auth.accessToken)"
  'Idempotency-Key' = 'create-tenant-demo-0001'
}
$workspace = Invoke-RestMethod -Method Post `
  -Uri 'http://localhost:3000/v1/tenants' `
  -Headers $tenantHeaders `
  -ContentType 'application/json' `
  -Body (@{ name = 'Clinic Demo'; timezone = 'Asia/Ho_Chi_Minh' } | ConvertTo-Json)
```

Expected: one tenant, one active owner membership, system roles and general chat channel.
Repeating the tenant request with the same key/body returns the same resource; changing the
body with the same key returns `409 IDEMPOTENCY_KEY_REUSED`.

## 8. Tenant-isolation proof

1. Create a second fake user and tenant using different tokens.
2. Use user A's bearer token against tenant B's branch, membership, form, channel, media and
   audit routes.
3. Also place tenant B resource IDs inside path, query, body and nested JSON fields.

Expected for every case:

- request is denied with the documented safe problem response;
- response does not confirm whether the resource exists;
- no row, message, object URL or audit payload from tenant B is returned;
- logs contain a correlation ID but no Google/refresh/invite/signed tokens.

The same matrix is automated in the integration suite and is required for the Module 1 gate.

## 9. Dynamic form proof

1. Create a template as an authorized owner.
2. Publish schema version 1 and submit valid/invalid payloads.
3. Publish version 2 and query both submissions.

Expected: invalid data is rejected atomically; old submission still references immutable
version 1 and the audit stream records both publications.

## 10. Media and realtime proof

- With memory storage, create upload intent, place the expected fake object, complete twice,
  and request download as authorized/unauthorized users.
- Connect two Socket.IO test clients to one channel, retry the same `clientMessageId`, then
  revoke one membership and reconnect.

Expected: one media/message effect, no foreign URL/room access, and revoked membership loses
the tenant rooms. Production S3/Redis configuration is exercised by adapter contract tests,
not live credentials.

## 11. Load smoke

```powershell
corepack pnpm load:smoke
```

Expected: smoke profile validates scripts and thresholds locally. Full target profile runs in
an environment sized for 200 requests/second and 2,000 realtime connections before production.

## Completion evidence

Capture command exit codes, migration name/checksum, seed counts, test summary and load-smoke
summary. Module 2 may start only when `speckit-converge` finds no remaining Module 1 task.
