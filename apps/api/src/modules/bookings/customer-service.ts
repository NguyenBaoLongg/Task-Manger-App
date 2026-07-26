import { ProblemError } from '@adsup/domain';
import type { BookingRepository, PermissionScope } from '@adsup/database';

export interface BookingAuthorization {
  resolvePermissionScope(
    tenantId: string,
    membershipId: string,
    permission: string,
  ): Promise<PermissionScope>;
}

function allowedBranches(scope: PermissionScope): string[] | null {
  return scope.tenantWide ? null : scope.branchIds;
}

function permits(scope: PermissionScope, branchIds: string[]): boolean {
  return scope.tenantWide || branchIds.every((branchId) => scope.branchIds.includes(branchId));
}

export class CustomerService {
  constructor(
    private readonly repository: BookingRepository,
    private readonly authorization: BookingAuthorization,
  ) {}

  async list(input: {
    tenantId: string;
    actorMembershipId: string;
    branchId?: string;
    cursor?: string;
    limit: number;
  }) {
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.customer.read',
    );
    if (input.branchId && !permits(scope, [input.branchId])) {
      return { items: [], nextCursor: null };
    }
    return this.repository.listCustomers({
      tenantId: input.tenantId,
      allowedBranchIds: allowedBranches(scope),
      branchId: input.branchId,
      cursor: input.cursor,
      limit: input.limit,
    });
  }

  async get(input: { tenantId: string; actorMembershipId: string; customerId: string }) {
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.customer.read',
    );
    const customer = await this.repository.getCustomer({
      tenantId: input.tenantId,
      customerId: input.customerId,
      allowedBranchIds: allowedBranches(scope),
    });
    if (!customer) {
      throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy khách hàng.');
    }
    return customer;
  }

  async create(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    displayName: string;
    phone?: string;
    email?: string;
    note?: string;
    branchIds: string[];
  }) {
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.customer.manage',
    );
    const branchIds = [...new Set(input.branchIds)].sort();
    if (!permits(scope, branchIds)) {
      throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Không có quyền tại cơ sở đã chọn.');
    }
    const customer = await this.repository.createCustomer({
      tenantId: input.tenantId,
      actorMembershipId: input.actorMembershipId,
      correlationId: input.correlationId,
      displayName: input.displayName.trim(),
      phoneNormalized: input.phone?.replace(/[^\d+]/g, ''),
      emailNormalized: input.email?.trim().toLowerCase(),
      note: input.note?.trim(),
      branchIds,
    });
    if (!customer) {
      throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy cơ sở.');
    }
    return customer;
  }

  async update(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    customerId: string;
    expectedStateVersion: number;
    reason: string;
    displayName?: string;
    phone?: string | null;
    email?: string | null;
    note?: string | null;
    branchIds?: string[];
  }) {
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.customer.manage',
    );
    const existing = await this.repository.getCustomer({
      tenantId: input.tenantId,
      customerId: input.customerId,
      allowedBranchIds: allowedBranches(scope),
    });
    if (!existing) {
      throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy khách hàng.');
    }
    const branchIds = input.branchIds ? [...new Set(input.branchIds)].sort() : undefined;
    if (
      branchIds &&
      (!permits(scope, branchIds) ||
        (!scope.tenantWide &&
          !existing.branchIds.every((branchId) => scope.branchIds.includes(branchId))))
    ) {
      throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Không có quyền tại cơ sở đã chọn.');
    }
    const customer = await this.repository.updateCustomer({
      tenantId: input.tenantId,
      customerId: input.customerId,
      actorMembershipId: input.actorMembershipId,
      correlationId: input.correlationId,
      expectedStateVersion: input.expectedStateVersion,
      reason: input.reason.trim(),
      displayName: input.displayName?.trim(),
      phoneNormalized: input.phone === null ? null : input.phone?.replace(/[^\d+]/g, ''),
      emailNormalized: input.email === null ? null : input.email?.trim().toLowerCase(),
      note: input.note === null ? null : input.note?.trim(),
      branchIds,
    });
    if (!customer) {
      throw new ProblemError(
        409,
        'CONFLICT',
        'Hồ sơ khách hàng đã thay đổi hoặc tham chiếu không còn hiệu lực.',
      );
    }
    return customer;
  }
}
