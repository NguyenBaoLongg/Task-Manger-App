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
