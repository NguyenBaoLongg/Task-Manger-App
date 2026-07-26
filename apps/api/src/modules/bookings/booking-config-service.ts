import { ProblemError } from '@adsup/domain';
import type { BookingAuthorization } from './customer-service.js';
import type { BookingRepository } from '@adsup/database';

export class BookingConfigService {
  constructor(
    private readonly repository: BookingRepository,
    private readonly authorization: BookingAuthorization,
  ) {}

  async listCancellationReasons(input: {
    tenantId: string;
    actorMembershipId: string;
    effectiveAt?: Date;
  }) {
    await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.read',
    );
    return {
      items: await this.repository.listCancellationReasonVersions({
        tenantId: input.tenantId,
        effectiveAt: input.effectiveAt ?? new Date(),
      }),
    };
  }

  async createCancellationReasonVersion(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    reasonId?: string;
    code: string;
    label: string;
    appliesToCancellation: boolean;
    appliesToReschedule: boolean;
    status: 'ACTIVE' | 'INACTIVE';
    effectiveFrom: Date;
  }) {
    await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.config.manage',
    );
    if (!input.appliesToCancellation && !input.appliesToReschedule) {
      throw new ProblemError(
        422,
        'BUSINESS_RULE_VIOLATION',
        'Reason must apply to at least one operation.',
      );
    }
    return this.repository.createCancellationReasonVersion(input);
  }

  async listEffectiveServices(input: {
    tenantId: string;
    actorMembershipId: string;
    branchId?: string;
    effectiveAt?: Date;
  }) {
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.read',
    );
    if (input.branchId && !scope.tenantWide && !scope.branchIds.includes(input.branchId)) {
      throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Branch is outside the actor scope.');
    }
    return {
      items: await this.repository.listEffectiveServices({
        tenantId: input.tenantId,
        allowedBranchIds: scope.tenantWide ? null : scope.branchIds,
        branchId: input.branchId,
        effectiveAt: input.effectiveAt ?? new Date(),
      }),
    };
  }

  async createServiceOfferingVersion(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    serviceOfferingId?: string;
    code: string;
    name: string;
    description?: string;
    branchIds: string[];
    status: 'ACTIVE' | 'INACTIVE';
    effectiveFrom: Date;
  }) {
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.config.manage',
    );
    if (
      !scope.tenantWide &&
      input.branchIds.some((branchId) => !scope.branchIds.includes(branchId))
    ) {
      throw new ProblemError(
        403,
        'AUTHORIZATION_DENIED',
        'Service branch is outside the actor scope.',
      );
    }
    return this.repository.createServiceOfferingVersion(input);
  }

  async createCustomerPhotoConsentPolicyVersion(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    title: string;
    policyText: string;
    allowedMethods: Array<'VERBAL' | 'WRITTEN' | 'OTHER'>;
    status: 'ACTIVE' | 'INACTIVE';
    effectiveFrom: Date;
  }) {
    await this.requireTenantWidePermission(
      input.tenantId,
      input.actorMembershipId,
      'booking.config.manage',
    );
    return this.repository.createCustomerPhotoConsentPolicyVersion(input);
  }

  async getEffectiveCustomerPhotoConsentPolicy(input: {
    tenantId: string;
    actorMembershipId: string;
    effectiveAt?: Date;
  }) {
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.config.read',
    );
    if (!scope.tenantWide && scope.branchIds.length === 0) {
      throw new ProblemError(
        403,
        'AUTHORIZATION_DENIED',
        'Configuration is outside the actor scope.',
      );
    }
    return this.repository.getEffectiveCustomerPhotoConsentPolicy({
      tenantId: input.tenantId,
      effectiveAt: input.effectiveAt ?? new Date(),
    });
  }

  async createBookingRetentionPolicyVersion(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    customerPhotoDays: number;
    xlsxDays: number;
    effectiveFrom: Date;
  }) {
    await this.requireTenantWidePermission(
      input.tenantId,
      input.actorMembershipId,
      'booking.retention.manage',
    );
    return this.repository.createBookingRetentionPolicyVersion(input);
  }

  async getEffectiveBookingRetentionPolicy(input: {
    tenantId: string;
    actorMembershipId: string;
    effectiveAt?: Date;
  }) {
    await this.requireTenantWidePermission(
      input.tenantId,
      input.actorMembershipId,
      'booking.config.read',
    );
    const policy = await this.repository.getEffectiveBookingRetentionPolicy({
      tenantId: input.tenantId,
      effectiveAt: input.effectiveAt ?? new Date(),
    });
    if (!policy)
      throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Retention policy was not found.');
    return policy;
  }

  async changeMediaLegalHold(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    mediaId: string;
    action: 'PLACE' | 'RELEASE';
    reason: string;
  }) {
    const target = await this.repository.getMediaRetentionScope({
      tenantId: input.tenantId,
      mediaId: input.mediaId,
    });
    if (!target) throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Media was not found.');
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.legal-hold.manage',
    );
    if (!scope.tenantWide && (!target.branchId || !scope.branchIds.includes(target.branchId))) {
      throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Media is outside the actor scope.');
    }
    return this.repository.changeMediaLegalHold(input);
  }

  private async requireTenantWidePermission(
    tenantId: string,
    actorMembershipId: string,
    permission: 'booking.config.manage' | 'booking.config.read' | 'booking.retention.manage',
  ) {
    const scope = await this.authorization.resolvePermissionScope(
      tenantId,
      actorMembershipId,
      permission,
    );
    if (!scope.tenantWide) {
      throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Tenant-wide permission is required.');
    }
  }
}
