import { ProblemError } from '@adsup/domain';
import type { BookingRepository, PermissionScope } from '@adsup/database';
import type { FormValidator } from '../forms/form-validator.js';
import type { MediaService } from '../media/media-service.js';
import type { BookingAuthorization } from './customer-service.js';

function allowedBranches(scope: PermissionScope): string[] | null {
  return scope.tenantWide ? null : scope.branchIds;
}

function permits(scope: PermissionScope, branchId: string): boolean {
  return scope.tenantWide || scope.branchIds.includes(branchId);
}

function localBusinessDate(value: Date, timezone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  return new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00.000Z`);
}

export class ArrivalService {
  constructor(
    private readonly repository: BookingRepository,
    private readonly authorization: BookingAuthorization,
    private readonly formValidator: FormValidator,
    private readonly mediaService: MediaService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async bookingForPermission(input: {
    tenantId: string;
    actorMembershipId: string;
    bookingId: string;
    permission: string;
  }) {
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      input.permission,
    );
    const booking = await this.repository.getBooking({
      tenantId: input.tenantId,
      bookingId: input.bookingId,
      allowedBranchIds: allowedBranches(scope),
    });
    if (!booking) {
      throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy lịch hẹn.');
    }
    return booking;
  }

  async recordConsent(input: {
    tenantId: string;
    actorMembershipId: string;
    bookingId: string;
    method: 'VERBAL' | 'WRITTEN' | 'OTHER';
    policyVersionId: string;
    correlationId: string;
  }) {
    await this.bookingForPermission({ ...input, permission: 'booking.arrival.manage' });
    return this.repository.recordCustomerPhotoConsent(input);
  }

  async createCustomerPhotoUploadIntent(input: {
    tenantId: string;
    actorMembershipId: string;
    bookingId: string;
    consentId: string;
    contentType: 'image/jpeg' | 'image/png' | 'image/webp';
    byteSize: number;
    checksumSha256: string;
    correlationId: string;
  }) {
    const booking = await this.bookingForPermission({
      ...input,
      permission: 'booking.arrival.manage',
    });
    const result = await this.mediaService.createIntent({
      tenantId: input.tenantId,
      actorMembershipId: input.actorMembershipId,
      branchId: booking.branchId,
      sourceType: 'BOOKING',
      sourceId: booking.id,
      purpose: 'CUSTOMER_BOOKING_PHOTO',
      consentId: input.consentId,
      contentType: input.contentType,
      byteSize: input.byteSize,
      checksumSha256: input.checksumSha256,
      correlationId: input.correlationId,
    });
    return {
      consentId: input.consentId,
      mediaId: result.media.id,
      uploadUrl: result.upload.url,
      expiresAt: result.upload.expiresAt,
      requiredHeaders: result.upload.requiredHeaders,
    };
  }

  async createWalkIn(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    idempotencyKey: string;
    branchId: string;
    customerId: string;
    serviceOfferingId: string;
    assignedMembershipId: string;
    consentMethod: 'VERBAL' | 'WRITTEN' | 'OTHER';
    consentPolicyVersionId: string;
    formTemplateId: string;
    formVersionId: string;
    formData: unknown;
  }) {
    const occurredAt = this.now();
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.manage',
    );
    if (!permits(scope, input.branchId)) {
      throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Không có quyền tại cơ sở đã chọn.');
    }
    const [customer, service, assignment, formVersion, timezone] = await Promise.all([
      this.repository.getCustomerForBranch(input.tenantId, input.customerId, input.branchId),
      this.repository.getEffectiveService(
        input.tenantId,
        input.serviceOfferingId,
        input.branchId,
        occurredAt,
      ),
      this.repository.getEffectiveAssignment(
        input.tenantId,
        input.assignedMembershipId,
        input.branchId,
        occurredAt,
      ),
      this.repository.getPublishedFormVersion(
        input.tenantId,
        input.formTemplateId,
        input.formVersionId,
        occurredAt,
      ),
      this.repository.getBookingTimezone(input.tenantId, input.branchId),
    ]);
    if (
      !customer ||
      !service ||
      !assignment ||
      !formVersion ||
      formVersion.status !== 'PUBLISHED' ||
      formVersion.formTemplateId !== input.formTemplateId ||
      !timezone
    ) {
      throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy tham chiếu lịch hẹn.');
    }
    this.formValidator.validate(this.formValidator.compile(formVersion.jsonSchema), input.formData);
    const result = await this.repository.createWalkInBooking({
      ...input,
      serviceOfferingVersionId: service.id,
      serviceCodeSnapshot: service.code,
      serviceNameSnapshot: service.name,
      occurredAt,
      businessDate: localBusinessDate(occurredAt, timezone),
      timezoneSnapshot: timezone,
      formData: structuredClone(input.formData),
    });
    if (!result) {
      throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Tham chiếu lịch hẹn không còn hiệu lực.');
    }
    return result;
  }

  async recordArrival(input: {
    tenantId: string;
    actorMembershipId: string;
    bookingId: string;
    consentId: string;
    customerPhotoMediaId?: string;
    expectedStateVersion: number;
    correlationId: string;
  }) {
    await this.bookingForPermission({ ...input, permission: 'booking.arrival.manage' });
    return this.repository.recordArrival(input);
  }

  async listPhotoDebts(input: {
    tenantId: string;
    actorMembershipId: string;
    branchId?: string;
    state?: 'OPEN' | 'RESOLVED' | 'WAIVED';
    cursor?: string;
    limit: number;
  }) {
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.photo-debt.read',
    );
    if (input.branchId && !permits(scope, input.branchId)) {
      return { items: [], nextCursor: null };
    }
    return this.repository.listPhotoDebts({
      ...input,
      allowedBranchIds: allowedBranches(scope),
    });
  }

  async completeTour(input: {
    tenantId: string;
    actorMembershipId: string;
    bookingId: string;
    customerPhotoMediaId: string;
    formSubmissionId?: string;
    expectedBookingStateVersion: number;
    correlationId: string;
  }) {
    await this.bookingForPermission({ ...input, permission: 'booking.tour.complete' });
    return this.repository.completeTour({
      ...input,
      performedByMembershipId: input.actorMembershipId,
    });
  }
}
