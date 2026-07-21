# Xác minh Module 2: KPI hằng ngày và việc cần hoàn thành

**Ngày xác minh**: 2026-07-20  
**Kết quả**: PASS — đủ điều kiện đóng Module 2 và mở Module 3.

## Phạm vi đã xác minh

- 30 FR, 6 CR, 9 SC, 5 user story và 106 task được đối chiếu với spec, plan, contract, migration, code và test.
- Nhân viên có đúng một cơ sở hiện hành; lịch sử điều chuyển vẫn được giữ. Thiếu hoặc trùng assignment sẽ fail-safe thành `DATA_QUALITY`, không tự đoán policy và không tạo phạt.
- KPI doanh số, số nhiệm vụ hoàn thành và tỷ lệ đúng giờ có target/mapping/policy versioned. Nguồn tỷ lệ đúng giờ giữ adapter boundary cho Module 3.
- Báo cáo 18:00 inclusive đến 20:00 exclusive, revision bất biến, progress/remaining chính xác, action item cá nhân/quản lý, đánh giá cuối ngày, một penalty KPI/người/ngày, adjustment append-only và evidence debt đều đã có.
- Worker có lease/checkpoint/rerun, outbox retry/dead-letter, Redis realtime theo room tenant + membership và push relay webhook có Bearer secret cùng `Idempotency-Key`.

## Môi trường kiểm thử

| Thành phần | Giá trị |
|---|---|
| Hệ điều hành | Windows 10.0.26200 x64 |
| CPU / RAM | Intel Core i9-13900H, 20 logical CPU, 16 GiB RAM |
| Node / pnpm | Node 24.12.0, pnpm 10.28.0 |
| Database | Prisma Dev PostgreSQL 17.5 WASM/PGlite, TCP local |
| Database nâng cấp | `adsup-module2`, 7 migration, cổng local 51218 |
| Database clean deploy | `adsup-module2-clean`, tạo từ trống, 7 migration, cổng local 51222 |

## Migration và seed

| Cổng | Kết quả |
|---|---|
| `prisma format` | PASS |
| `prisma validate` | PASS |
| `prisma generate` và `pnpm db:generate` | PASS |
| Clean `prisma migrate deploy` | PASS, áp dụng tuần tự 7/7 migration |
| Upgrade/status trên database Module 2 | PASS, schema up to date, không drift |
| Seed chạy ba lần trên clean database | PASS, idempotent |
| `pnpm db:migrate:deploy` / `pnpm db:seed` | PASS |
| Live migration tests | PASS, 3 file / 10 test |

Seed xác định sau ba lần chạy:

```json
{"tenantName":"Công ty TNHH ABC","memberships":30,"membershipsWithOneBranch":30,"definitions":["COMPLETED_TASKS","DAILY_REVENUE","ON_TIME_RATE"],"targets":3,"mappings":3,"policies":1,"forms":3,"permissions":8}
```

## Cổng chất lượng tự động

| Cổng | Kết quả |
|---|---|
| `pnpm format:check` | PASS |
| `pnpm lint` | PASS, 0 warning/error |
| `pnpm typecheck` | PASS, 7/7 workspace project |
| Unit | PASS, 22 file / 55 test |
| Contract | PASS, 13 file / 29 test; 15 KPI OpenAPI operations có runtime conformance |
| Integration API + worker | PASS, 21 file / 43 test trên database Module 2 |
| Coverage toàn bộ | PASS, 59 file / 137 test |
| Coverage | 69,44% statements; 55,74% branches; 70,16% functions; 70,79% lines |
| OpenAPI validation | PASS, 1 file / 2 test |
| Build | PASS, 7/7 workspace project |

Các cổng rủi ro cao đã đạt:

- 100 lần close/evaluation đồng thời hoặc retry tạo đúng một evaluation và tối đa một penalty.
- 100 lần evidence reminder/finalization retry không tạo trùng reminder, transition hoặc photo penalty.
- Concurrent penalty adjustment không làm effective amount âm và không sửa bản ghi gốc.
- Cross-tenant/cross-branch/self-scope bị chặn; cursor giữ scope; outbox claim dùng `FOR UPDATE SKIP LOCKED`.
- Replay progress không tạo thêm action-item transition/outbox khi projection không đổi.

## Quickstart và traceability

| Kịch bản quickstart | Bằng chứng chính |
|---|---|
| Policy tenant/branch, target/mapping version | `kpi-config*.integration.test.ts` |
| Hai report revision, mốc đúng 20:00 | `kpi-report.integration.test.ts`, policy unit tests |
| Progress, remaining, action item, realtime | `kpi-progress-realtime.integration.test.ts` |
| Close-day, policy history, fail-safe branch, resume | `kpi-close-day*.integration.test.ts` |
| Penalty correction append-only | `kpi-adjustment.integration.test.ts` |
| Evidence READY/owner/source/status và 100 retry | `kpi-evidence*.integration.test.ts` |
| Toàn bộ API công bố | `kpi-published-http.contract.test.ts` |

Traceability trong `tasks.md` ánh xạ đủ FR-001–FR-030 và CR-001–CR-006. SC-001–SC-008 được chứng minh bằng unit/contract/integration/migration/concurrency; SC-009 được chứng minh bằng load smoke có giới hạn mô tả dưới đây.

## Load, bảo mật và redaction

- Load smoke: `KPI_LOAD_SMOKE_OK`, 10.000 membership, batch 200, 50 page, p95 0,52 ms cho projection/action-item synthetic local; mục tiêu dưới 500 ms đạt trong profile này.
- Secret scan trên source/spec/config, loại trừ dependency/generated/build/coverage: `SECRET_SCAN_OK`.
- Logger chỉ ghi error name/problem code/correlation; token, secret và URL được redact.
- Audit/outbox dùng payload allowlist/redacted; không đưa raw form, revenue payload, media URL hay email vào event.

## Giới hạn được công khai

- Load smoke là synthetic in-process trên laptop, không phải chứng nhận tải production hoặc cam kết 2.000 kết nối đồng thời.
- Clean deploy dùng Prisma Dev PostgreSQL WASM/PGlite; staging/production vẫn phải chạy rehearsal trên PostgreSQL native, Redis và hạ tầng thật trước go-live.
- Local/test không cần credential FCM/APNs. `PUSH_DRIVER=webhook` mới xác minh contract/retry bằng test double; chưa gửi push thật tới thiết bị.
- Redis adapter và schema envelope đã có, nhưng không chạy integration với Redis server thật trong local gate này.
- Tỷ lệ đi làm đúng giờ chỉ có source adapter/test double; dữ liệu chấm công authoritative được triển khai ở Module 3.
- Perceptual hash giữ nullable và bị vô hiệu hóa trong MVP; hệ thống không tự kết luận ảnh trùng/gian lận.

## Kết luận Spec Kit

- Analyze sau implementation: không còn mâu thuẫn, placeholder hoặc requirement không có task; 45/45 requirement/constraint/success criterion có coverage, 106/106 task có bằng chứng.
- Convergence: không phát hiện phần việc implementation còn thiếu trong phạm vi Module 2; không cần thêm phase/task convergence.

