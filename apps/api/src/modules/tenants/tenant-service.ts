import { randomUUID } from 'node:crypto';
import { ProblemError } from '@adsup/domain';
import { requestHash, type AuthTenantsRepository, type Tenant } from '@adsup/database';

const slugify = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export class TenantService {
  constructor(private readonly repository: AuthTenantsRepository) {}
  async create(input: {
    userId: string;
    name: string;
    timezone?: string;
    correlationId: string;
    idempotencyKey: string;
  }) {
    const user = await this.repository.getUser(input.userId);
    if (!user?.fullNameConfirmedAt)
      throw new ProblemError(
        409,
        'PROFILE_CONFIRMATION_REQUIRED',
        'Cần xác nhận họ tên trước khi tạo doanh nghiệp.',
      );
    const tenantId = randomUUID();
    const normalized = { name: input.name.trim(), timezone: input.timezone ?? 'Asia/Ho_Chi_Minh' };
    const result = await this.repository.bootstrapTenant({
      tenantId,
      ownerMembershipId: randomUUID(),
      userId: input.userId,
      name: normalized.name,
      slug: `${slugify(input.name)}-${tenantId.slice(0, 8)}`,
      timezone: normalized.timezone,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      requestHash: requestHash(normalized),
    });
    return this.presentSummary(result);
  }
  async list(userId: string) {
    return (await this.repository.listTenants(userId)).map((item) => this.presentSummary(item));
  }
  async get(tenantId: string): Promise<Tenant> {
    const tenant = await this.repository.getTenant(tenantId);
    if (!tenant) throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy doanh nghiệp.');
    return tenant;
  }
  updateStatus(input: {
    tenantId: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return this.repository.updateTenantStatus(input);
  }
  private presentSummary(result: {
    tenant: Tenant;
    membership: {
      id: string;
      tenantId: string;
      userId: string;
      membershipDisplayName: string;
      employeeCode: string | null;
      status: string;
      version: number;
    };
  }) {
    return {
      tenant: result.tenant,
      membership: {
        id: result.membership.id,
        tenantId: result.membership.tenantId,
        userId: result.membership.userId,
        displayName: result.membership.membershipDisplayName,
        employeeCode: result.membership.employeeCode,
        status: result.membership.status,
        version: result.membership.version,
      },
    };
  }
}
