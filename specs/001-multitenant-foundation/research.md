# Phase 0 Research: Nền tảng SaaS đa tenant

## 1. Runtime và module system

**Decision**: Node.js 24 LTS, TypeScript 5.9+, ESM, pnpm workspace.

**Rationale**: Máy phát triển hiện có Node 24.12.0. Node 24 đã vào LTS và được hỗ trợ đến
tháng 04/2028; Prisma hiện hỗ trợ Node `^24.0.0`. ESM cũng là yêu cầu của Prisma 7.

**Alternatives considered**:

- Node 22 LTS: ổn định nhưng thấp hơn runtime đang có và không đem lại lợi ích tương thích.
- CommonJS: bị loại vì Prisma 7 là ESM và dự án mới không cần gánh tương thích cũ.

**Sources**:

- [Node.js v22 to v24](https://nodejs.org/en/blog/migrations/v22-to-v24)
- [Prisma system requirements](https://docs.prisma.io/docs/orm/reference/system-requirements)
- [Prisma v7 upgrade guide](https://www.prisma.io/docs/orm/v6/more/upgrades/to-v7)

## 2. HTTP framework và contract

**Decision**: Express 5 với REST `/v1`, OpenAPI 3.1 là contract có phiên bản.

**Rationale**: AGENTS.md chọn Express cho backend mới; Express 5 là dòng hiện hành và yêu
cầu Node 18+, phù hợp Node 24. Contract-first giúp mobile và các module sau ổn định trước khi
tiêu thụ API.

**Alternatives considered**:

- Fastify: hiệu năng và schema tốt nhưng trái baseline đã chọn.
- GraphQL: tăng độ phức tạp authorization/caching khi nghiệp vụ hiện phù hợp resource REST.

**Source**: [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5/)

## 3. PostgreSQL và Prisma

**Decision**: PostgreSQL 16+ production, Prisma 7 với generator `prisma-client` và
`@prisma/adapter-pg`; local/integration dùng `prisma dev` khi không có Docker.

**Rationale**: Prisma 7 bắt buộc driver adapter cho kết nối trực tiếp và hỗ trợ PostgreSQL
đến phiên bản 18. `prisma dev` chạy Prisma Postgres cục bộ bằng PGlite, không cần Docker hay
đăng nhập, phù hợp máy hiện tại không có Docker/psql.

**Alternatives considered**:

- SQLite cho test: bị loại vì không kiểm chứng JSONB, constraint và hành vi PostgreSQL.
- Chỉ mock database: giữ lại cho unit test nhưng không đủ cho migration/integration gate.
- Docker/Testcontainers: vẫn được hỗ trợ trong CI tùy chọn nhưng không phải điều kiện local.

**Sources**:

- [Prisma ORM overview and v7 connection requirements](https://www.prisma.io/docs/orm)
- [Prisma supported databases](https://www.prisma.io/docs/orm/reference/supported-databases)
- [Local development with Prisma Postgres](https://docs.prisma.io/docs/postgres/database/local-development)

## 4. Tenant isolation

**Decision**: `tenant_id` trên mọi bảng tenant-owned; composite unique/index/foreign-key theo
tenant; tenant context lấy từ JWT + membership; repository API luôn cần `TenantContext`.
PostgreSQL RLS chưa là lớp bắt buộc của Module 1 nhưng schema chừa đường bổ sung.

**Rationale**: Prisma connection pooling và transaction làm `SET LOCAL` cho RLS cần thêm
thiết kế vận hành; composite constraints + service authorization cho coverage rõ và không
phụ thuộc session state. Negative cross-tenant integration tests là gate bắt buộc.

**Alternatives considered**:

- Database-per-tenant/schema-per-tenant: vận hành migration và pooling phức tạp quá mức cho
  mục tiêu 100 tenant/500 cơ sở.
- Chỉ lọc `tenant_id` trong controller: bị loại vì dễ bỏ sót ở job/repository.

## 5. Authentication và session

**Decision**: Xác minh Google ID token qua adapter và dùng Google `sub` làm external identity;
JWT access token sống 15 phút, refresh token opaque xoay vòng và chỉ lưu hash. Membership
được kiểm tra lại cho thao tác đặc quyền; logout/reuse refresh token thu hồi token family.

**Rationale**: Email và tên Google có thể đổi hoặc thiếu; `sub` ổn định. Access ngắn hạn giảm
rủi ro, refresh rotation cho phép thu hồi và phát hiện replay. Test dùng fake verifier.

**Alternatives considered**:

- Dùng email làm khóa: bị loại vì email có thể đổi.
- JWT refresh không lưu trạng thái: không đáp ứng yêu cầu thu hồi membership/session.

## 6. RBAC và phạm vi

**Decision**: Permission catalog toàn cục; Role tenant-scoped; RolePermission và
MembershipRoleBinding có scope `TENANT` hoặc `BRANCH`. Assignment cơ cấu không cấp quyền.

**Rationale**: Tách “nhân viên làm ở đâu” khỏi “được quản lý gì” ngăn privilege escalation
và bám đúng PRD. Tenant Owner là system role không thể xóa và tenant luôn phải còn ít nhất
một owner hoạt động.

## 7. Dynamic forms

**Decision**: JSON Schema draft 2020-12, Ajv strict mode + formats; FormVersion bất biến và
Submission lưu `form_version_id` + JSONB đã validate. Chỉ một draft có thể chỉnh sửa; publish
tạo version mới trong transaction.

**Rationale**: 2020-12 có mô hình schema hiện đại, còn Ajv yêu cầu instance riêng cho draft
này; chọn một draft duy nhất tránh schema behavior không nhất quán.

**Alternatives considered**:

- Draft-07: nhanh hơn một chút nhưng hạn chế mở rộng schema mới.
- JSON tự do không schema: bị loại vì không thể bảo đảm dữ liệu KPI/form về sau.

**Sources**:

- [Ajv JSON Schema versions](https://ajv.js.org/json-schema)
- [Ajv schema language guide](https://ajv.js.org/guide/schema-language)

## 8. Media object storage

**Decision**: S3-compatible adapter, presigned PUT/GET tối đa 5 phút, object key có tenant +
UUID không đoán được, ký `content-type` và checksum; completion dùng HEAD/metadata verify.
Test dùng in-memory object storage.

**Rationale**: Client không nhận credential cloud, binary không đi qua PostgreSQL/API, và
server chỉ đánh dấu READY sau khi xác minh object.

**Source**: [AWS SDK v3 S3 request presigner](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-request-presigner/)

## 9. Realtime và Redis

**Decision**: Socket.IO 4; room key luôn chứa tenant/channel; production dùng Redis Streams
adapter + node-redis, local dùng in-memory adapter. Reconnect luôn re-authorize membership và
client đồng bộ lại message từ cursor server.

**Rationale**: Redis Streams adapter khôi phục sau Redis disconnect và hỗ trợ Socket.IO
connection state recovery; classic Pub/Sub adapter không hỗ trợ recovery. Redis phải ở mạng
nội bộ, ACL/TLS và credential riêng.

**Alternatives considered**:

- Classic Redis adapter: bị loại cho production vì mất recovery và có cảnh báo reconnect.
- ioredis: không chọn vì Redis hiện khuyến nghị node-redis cho ứng dụng mới.

**Sources**:

- [Socket.IO Redis Streams adapter](https://socket.io/docs/v4/redis-streams-adapter/)
- [Socket.IO connection state recovery](https://socket.io/docs/v4/connection-state-recovery)
- [Redis Node.js client](https://redis.io/docs/latest/integrate/node-redis/)

## 10. Push notification

**Decision**: `PushProvider` port với Noop/InMemory provider cho local và production provider
factory cho FCM/APNs. Module 1 quản lý endpoint và contract, không gửi business notification.

**Rationale**: Giữ credential ngoài code/test và tránh trộn logic KPI/attendance/booking vào
nền tảng. Module sở hữu nghiệp vụ sẽ tạo notification command sau.

## 11. Audit, idempotency và lỗi

**Decision**: AuditEvent tenant-scoped append-only; SecurityEvent cho sự kiện account trước
khi có tenant. Mutation dùng `Idempotency-Key` + request fingerprint, lưu response có giới
hạn; key reuse với payload khác trả conflict. Error dùng `application/problem+json`, machine
code và correlation ID.

**Rationale**: Tách global/tenant audit giữ nguyên tenant invariant. Response replay cho phép
mobile retry an toàn khi mạng không ổn định.

## 12. Test và quality gate

**Decision**: Vitest + Supertest; unit test domain thuần, contract test OpenAPI/error shape,
integration test Prisma/PostgreSQL, negative tenant isolation, migration/seed rerun, và k6
smoke/load script. Typecheck, ESLint, Prettier check và build chạy ở root.

**Rationale**: Vitest hỗ trợ Node hiện tại; test được chia lớp để local nhanh nhưng vẫn có
gate PostgreSQL thật bằng Prisma local. Cloud adapter dùng test double.

**Source**: [Vitest getting started](https://vitest.dev/guide/)

## Resolved Unknowns

Mọi unknown ảnh hưởng Module 1 đã được giải quyết. Hosting provider, production SLA/RPO/RTO chi tiết và cloud
credentials là quyết định triển khai production ngoài Module 1; architecture vẫn cung cấp
health, backup/restore runbook và adapter boundaries để bổ sung mà không đổi domain contract.
