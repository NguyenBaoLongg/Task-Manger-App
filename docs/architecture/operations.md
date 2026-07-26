# Vận hành Module 1

## Migration và rollback

- Migration SQL là append-only và được review; production chạy `prisma migrate deploy`.
- Không rollback phá dữ liệu tự động. Khi migration thất bại trước commit, sửa forward migration
  trong môi trường chưa phát hành; sau phát hành tạo migration bù.
- Trước thay đổi cấu trúc phải có backup PostgreSQL và diễn tập restore tại staging. RPO/RTO do
  kế hoạch triển khai production xác nhận, không được ngầm hứa trong mã.

## Adapter và sự cố

- `/health/live` chỉ xác nhận process; `/health/ready` kiểm tra database và không lộ URL/secret.
- S3, Redis Streams, FCM/APNs có interface tách biệt. Local dùng memory/noop; production không
  phụ thuộc live credential trong test.
- Log luôn có correlation ID và redaction token, cookie, signed URL. Audit chứa snapshot đã làm sạch.

## Khôi phục

1. Dừng mutation/worker, ghi nhận migration checksum và thời điểm sự cố.
2. Khôi phục backup sang database mới, chạy kiểm tra tenant counts và audit continuity.
3. Trỏ ứng dụng qua secret manager, chạy readiness + negative tenant-isolation smoke.
4. Mở lại traffic theo từng phần và giữ database cũ read-only đến khi đối soát hoàn tất.

## Module 4 booking and export operations

The booking API and worker are tenant-scoped. Branch scope is checked again at every booking, report, export download, media and retention operation. Keep PostgreSQL as the source of truth; outbox rows, leases, idempotency keys, audit events, XLSX checksums and retention tombstones are operational records, not disposable cache entries.

### Local startup

Set `DATABASE_URL`, run `db:generate`, `db:migrate:deploy`, `db:seed`, and verify the booking seed. Start `dev:api` and `dev:worker` in separate terminals. The local object storage adapter writes export artifacts under `LOCAL_EXPORT_DIR` (default `.data/exports`) and does not need AWS credentials. Use `OBJECT_STORAGE_DRIVER=s3` with an S3-compatible endpoint only in an environment that has its own secret management.

### Worker and retry handling

The worker processes report scheduling, XLSX export, outbox delivery, photo debt and booking/media retention with database leases. Failed attempts use bounded backoff; dedupe keys and idempotent state transitions prevent duplicate delivery or penalty/media effects. Inspect worker metrics and the corresponding audit/outbox rows before replaying a failed job.

### Backup and restore

Create a `pg_dump -Fc` backup before migrations or retention policy changes. Restore to a new database, run `pg_restore`, deploy migrations, run seed verification and tenant-isolation/RBAC smoke tests, then compare audit continuity and outbox status. Media objects require a matching object-storage backup. Never remove a legal-held object; retention deletes binaries once, records a tombstone, and denies expired downloads.

### Gate commands

Use `format:check`, `lint`, `typecheck`, unit/contract/integration/migration tests, coverage, `load:smoke`, and `build` before opening the next module. Do not claim the Module 4 dependency gate until `$speckit-converge` has checked the final artifacts.
