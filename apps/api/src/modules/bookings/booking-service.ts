import { ProblemError } from '@adsup/domain';
import type { BookingRepository, PermissionScope } from '@adsup/database';
import type { FormValidator } from '../forms/form-validator.js';
import type { BookingAuthorization } from './customer-service.js';
import { bookingMetricNames } from '../../observability/index.js';

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

function isDatabaseConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    code?: string;
    message?: string;
    meta?: { database_error?: string };
    cause?: { code?: string; originalCode?: string; message?: string };
  };
  return (
    candidate.code === 'P2004' ||
    candidate.meta?.database_error?.includes('23P01') === true ||
    candidate.cause?.code === '23P01' ||
    candidate.cause?.originalCode === '23P01' ||
    candidate.message?.includes('booking_active_employee_60m_excl') === true ||
    candidate.cause?.message?.includes('booking_active_employee_60m_excl') === true
  );
}

export class BookingService {
  constructor(
    private readonly repository: BookingRepository,
    private readonly authorization: BookingAuthorization,
    private readonly formValidator: FormValidator,
    private readonly metrics?: { increment(name: string): void },
  ) {}

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
    if (input.branchId && !permits(scope, input.branchId)) return [];
    return this.repository.listEffectiveServices({
      tenantId: input.tenantId,
      allowedBranchIds: allowedBranches(scope),
      branchId: input.branchId,
      effectiveAt: input.effectiveAt ?? new Date(),
    });
  }

  async list(input: {
    tenantId: string;
    actorMembershipId: string;
    branchId?: string;
    businessDate?: string;
    status?: 'SCHEDULED' | 'ARRIVED' | 'NO_SHOW' | 'CANCELLED' | 'RESCHEDULED';
    assignedMembershipId?: string;
    cursor?: string;
    limit: number;
  }) {
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.read',
    );
    if (input.branchId && !permits(scope, input.branchId)) {
      return { items: [], nextCursor: null };
    }
    return this.repository.listBookings({
      tenantId: input.tenantId,
      allowedBranchIds: allowedBranches(scope),
      branchId: input.branchId,
      businessDate: input.businessDate
        ? new Date(`${input.businessDate}T00:00:00.000Z`)
        : undefined,
      status: input.status,
      assignedMembershipId: input.assignedMembershipId,
      cursor: input.cursor,
      limit: input.limit,
    });
  }

  async get(input: { tenantId: string; actorMembershipId: string; bookingId: string }) {
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.read',
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

  async createScheduled(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    idempotencyKey: string;
    branchId: string;
    customerId: string;
    serviceOfferingId: string;
    assignedMembershipId: string;
    scheduledStartAt: Date;
    formTemplateId: string;
    formVersionId: string;
    formData: unknown;
  }) {
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
        input.scheduledStartAt,
      ),
      this.repository.getEffectiveAssignment(
        input.tenantId,
        input.assignedMembershipId,
        input.branchId,
        input.scheduledStartAt,
      ),
      this.repository.getPublishedFormVersion(
        input.tenantId,
        input.formTemplateId,
        input.formVersionId,
        input.scheduledStartAt,
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
    const conflict = await this.repository.findBookingConflict({
      tenantId: input.tenantId,
      branchId: input.branchId,
      assignedMembershipId: input.assignedMembershipId,
      scheduledStartAt: input.scheduledStartAt,
    });
    if (conflict) {
      this.metrics?.increment(bookingMetricNames.conflict);
      throw new ProblemError(
        409,
        'BOOKING_CONFLICT',
        'Nhân sự đã có lịch hẹn trong khoảng cách 60 phút.',
      );
    }
    try {
      const booking = await this.repository.createScheduledBooking({
        tenantId: input.tenantId,
        branchId: input.branchId,
        customerId: input.customerId,
        serviceOfferingId: input.serviceOfferingId,
        serviceOfferingVersionId: service.id,
        serviceCodeSnapshot: service.code,
        serviceNameSnapshot: service.name,
        assignedMembershipId: input.assignedMembershipId,
        scheduledStartAt: input.scheduledStartAt,
        businessDate: localBusinessDate(input.scheduledStartAt, timezone),
        timezoneSnapshot: timezone,
        formTemplateId: input.formTemplateId,
        formVersionId: input.formVersionId,
        formData: structuredClone(input.formData),
        actorMembershipId: input.actorMembershipId,
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey,
      });
      if (!booking) {
        throw new ProblemError(
          404,
          'RESOURCE_NOT_FOUND',
          'Tham chiếu lịch hẹn không còn hiệu lực.',
        );
      }
      this.metrics?.increment(bookingMetricNames.created);
      return booking;
    } catch (error) {
      if (isDatabaseConflict(error)) {
        this.metrics?.increment(bookingMetricNames.conflict);
        throw new ProblemError(
          409,
          'BOOKING_CONFLICT',
          'Nhân sự đã có lịch hẹn trong khoảng cách 60 phút.',
        );
      }
      throw error;
    }
  }

  async recordOutcome(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    bookingId: string;
    outcome: 'NO_SHOW' | 'CANCELLED';
    reasonVersionId: string;
    evidenceMediaId?: string;
    expectedStateVersion: number;
  }) {
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.outcome.manage',
    );
    const booking = await this.repository.getBooking({
      tenantId: input.tenantId,
      bookingId: input.bookingId,
      allowedBranchIds: allowedBranches(scope),
    });
    if (!booking) throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Booking was not found.');
    return this.repository.recordBookingOutcome(input);
  }

  async reschedule(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    bookingId: string;
    scheduledStartAt: Date;
    assignedMembershipId: string;
    reasonVersionId: string;
    expectedStateVersion: number;
  }) {
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.manage',
    );
    const booking = await this.repository.getBooking({
      tenantId: input.tenantId,
      bookingId: input.bookingId,
      allowedBranchIds: allowedBranches(scope),
    });
    if (!booking) throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Booking was not found.');
    if (!permits(scope, booking.branchId)) {
      throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Booking branch is outside actor scope.');
    }
    try {
      return await this.repository.rescheduleBooking(input);
    } catch (error) {
      if (isDatabaseConflict(error)) {
        throw new ProblemError(
          409,
          'BOOKING_CONFLICT',
          'Replacement booking conflicts with another booking.',
        );
      }
      throw error;
    }
  }

  async correctOutcome(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    bookingId: string;
    outcome: 'NO_SHOW' | 'CANCELLED';
    reasonVersionId: string;
    expectedStateVersion: number;
  }) {
    const scope = await this.authorization.resolvePermissionScope(
      input.tenantId,
      input.actorMembershipId,
      'booking.outcome.correct',
    );
    const booking = await this.repository.getBooking({
      tenantId: input.tenantId,
      bookingId: input.bookingId,
      allowedBranchIds: allowedBranches(scope),
    });
    if (!booking) throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Booking was not found.');
    return this.repository.correctBookingOutcome(input);
  }
}
