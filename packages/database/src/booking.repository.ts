import { randomUUID } from 'node:crypto';
import { runInTransaction, type DatabaseExecutor, type DatabaseTransaction } from './client.js';
import type { Prisma } from './generated/prisma/client.js';
import {
  decideArrival,
  decideBookingOutcome,
  decideReschedule,
  decideTourCompletion,
  ProblemError,
  resolveReasonVersion,
} from '@adsup/domain';
import { ActionItemRepository } from './action-item.repository.js';

export interface PermissionScope {
  tenantWide: boolean;
  branchIds: string[];
}

export interface CustomerPageInput {
  tenantId: string;
  allowedBranchIds: string[] | null;
  branchId?: string;
  cursor?: string;
  limit: number;
}

export interface BookingPageInput extends CustomerPageInput {
  businessDate?: Date;
  status?: 'SCHEDULED' | 'ARRIVED' | 'NO_SHOW' | 'CANCELLED' | 'RESCHEDULED';
  assignedMembershipId?: string;
}

export interface ScheduledBookingWrite {
  tenantId: string;
  branchId: string;
  customerId: string;
  serviceOfferingId: string;
  serviceOfferingVersionId: string;
  serviceCodeSnapshot: string;
  serviceNameSnapshot: string;
  assignedMembershipId: string;
  scheduledStartAt: Date;
  businessDate: Date;
  timezoneSnapshot: string;
  formTemplateId: string;
  formVersionId: string;
  formData: unknown;
  actorMembershipId: string;
  correlationId: string;
  idempotencyKey: string;
}

export interface WalkInBookingWrite extends Omit<
  ScheduledBookingWrite,
  'scheduledStartAt' | 'businessDate'
> {
  occurredAt: Date;
  businessDate: Date;
  consentMethod: 'VERBAL' | 'WRITTEN' | 'OTHER';
  consentPolicyVersionId: string;
}

export interface CancellationReasonWrite {
  tenantId: string;
  reasonId?: string;
  code: string;
  label: string;
  appliesToCancellation: boolean;
  appliesToReschedule: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  effectiveFrom: Date;
  actorMembershipId: string;
  correlationId: string;
}

export interface BookingReportDestinationWrite {
  tenantId: string;
  actorMembershipId: string;
  correlationId: string;
  branchId?: string;
  reportType: 'TOMORROW_SCHEDULE' | 'TODAY_OUTCOME';
  chatChannelId: string;
}

export interface BookingServiceVersionWrite {
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
}

export interface CustomerPhotoConsentPolicyWrite {
  tenantId: string;
  actorMembershipId: string;
  correlationId: string;
  title: string;
  policyText: string;
  allowedMethods: Array<'VERBAL' | 'WRITTEN' | 'OTHER'>;
  status: 'ACTIVE' | 'INACTIVE';
  effectiveFrom: Date;
}

export interface BookingRetentionPolicyWrite {
  tenantId: string;
  actorMembershipId: string;
  correlationId: string;
  customerPhotoDays: number;
  xlsxDays: number;
  effectiveFrom: Date;
}

interface PhotoDebtWrite {
  tenantId: string;
  bookingId: string;
  branchId: string;
  customerId: string;
  ownerMembershipId: string;
  openedByMembershipId: string;
  openedReason: string;
  businessDate: Date;
  sourceEventId: string;
  correlationId: string;
}

function customerAuditSnapshot(customer: {
  id: string;
  displayName: string;
  phoneNormalized: string | null;
  emailNormalized: string | null;
  stateVersion: number;
}) {
  return {
    id: customer.id,
    displayName: customer.displayName,
    hasPhone: customer.phoneNormalized !== null,
    hasEmail: customer.emailNormalized !== null,
    stateVersion: customer.stateVersion,
  };
}

function decodeCursor(cursor?: string): string | undefined {
  if (!cursor) return undefined;
  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(decoded)) {
    throw new ProblemError(422, 'VALIDATION_FAILED', 'Cursor không hợp lệ.');
  }
  return decoded;
}

function encodeCursor(id?: string): string | null {
  return id ? Buffer.from(id, 'utf8').toString('base64url') : null;
}

function businessDateAt(value: Date, timezone: string) {
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

async function attachCustomerBranches(
  database: DatabaseExecutor,
  tenantId: string,
  customers: Array<Record<string, unknown> & { id: string }>,
) {
  if (customers.length === 0) return [];
  const access = await database.customerBranchAccess.findMany({
    where: {
      tenantId,
      customerId: { in: customers.map((customer) => customer.id) },
      revokedAt: null,
    },
    select: { customerId: true, branchId: true },
    orderBy: [{ branchId: 'asc' }],
  });
  return customers.map((customer) => ({
    ...customer,
    branchIds: access
      .filter((item) => item.customerId === customer.id)
      .map((item) => item.branchId),
  }));
}

function isAllowedConsentMethod(value: Prisma.JsonValue, method: string): boolean {
  return Array.isArray(value) && value.some((item) => item === method);
}

async function openPhotoDebt(transaction: DatabaseTransaction, input: PhotoDebtWrite) {
  const existing = await transaction.customerPhotoDebt.findUnique({
    where: {
      tenantId_bookingId: {
        tenantId: input.tenantId,
        bookingId: input.bookingId,
      },
    },
  });
  if (existing) return existing;
  const debt = await transaction.customerPhotoDebt.create({
    data: {
      tenantId: input.tenantId,
      branchId: input.branchId,
      bookingId: input.bookingId,
      customerId: input.customerId,
      ownerMembershipId: input.ownerMembershipId,
      openedByMembershipId: input.openedByMembershipId,
      openedReason: input.openedReason,
      sourceEventId: input.sourceEventId,
    },
  });
  const actionItem = await new ActionItemRepository(transaction).project({
    tenantId: input.tenantId,
    ownerMembershipId: input.ownerMembershipId,
    branchId: input.branchId,
    itemType: 'PHOTO_DEBT',
    sourceType: 'BOOKING_CUSTOMER_PHOTO_DEBT',
    sourceId: debt.id,
    businessDate: input.businessDate,
    state: 'OPEN',
    title: 'Bổ sung ảnh khách cho lịch hẹn',
    targetValue: '1',
    actualValue: '0',
    remainingValue: '1',
    unit: 'PHOTO',
    deadlineAt: new Date(input.businessDate.getTime() + 24 * 60 * 60_000 - 1),
    sourceFreshnessAt: new Date(),
    deepLink: `adsup://bookings/${input.bookingId}/customer-photo`,
    eventId: input.sourceEventId,
    correlationId: input.correlationId,
  });
  const linked = await transaction.customerPhotoDebt.update({
    where: { tenantId_id: { tenantId: input.tenantId, id: debt.id } },
    data: { actionItemId: actionItem.id },
  });
  await transaction.outboxEvent.create({
    data: {
      tenantId: input.tenantId,
      aggregateType: 'BOOKING_PHOTO_DEBT',
      aggregateId: debt.id,
      eventType: 'booking.photo-debt-changed.v1',
      dedupeKey: `booking-photo-debt:${debt.id}:v1`,
      payloadRedacted: {
        debtId: debt.id,
        bookingId: input.bookingId,
        branchId: input.branchId,
        ownerMembershipId: input.ownerMembershipId,
        fromState: null,
        toState: 'OPEN',
        actionItemId: actionItem.id,
        businessDate: input.businessDate.toISOString().slice(0, 10),
      },
      correlationId: input.correlationId,
    },
  });
  return linked;
}

export class BookingRepository {
  constructor(readonly database: DatabaseExecutor) {}

  async listCustomers(input: CustomerPageInput) {
    const allowed =
      input.branchId !== undefined
        ? [input.branchId]
        : input.allowedBranchIds === null
          ? undefined
          : input.allowedBranchIds;
    if (allowed?.length === 0) return { items: [], nextCursor: null };
    const scopedCustomerIds = allowed
      ? (
          await this.database.customerBranchAccess.findMany({
            where: {
              tenantId: input.tenantId,
              branchId: { in: allowed },
              revokedAt: null,
            },
            select: { customerId: true },
          })
        ).map((item) => item.customerId)
      : undefined;
    const cursorId = decodeCursor(input.cursor);
    const rows = await this.database.customer.findMany({
      where: {
        tenantId: input.tenantId,
        archivedAt: null,
        id:
          cursorId || scopedCustomerIds
            ? {
                ...(cursorId ? { gt: cursorId } : {}),
                ...(scopedCustomerIds ? { in: scopedCustomerIds } : {}),
              }
            : undefined,
      },
      orderBy: { id: 'asc' },
      take: input.limit + 1,
    });
    const hasNext = rows.length > input.limit;
    const page = hasNext ? rows.slice(0, input.limit) : rows;
    const items = await attachCustomerBranches(this.database, input.tenantId, page);
    return {
      items,
      nextCursor: hasNext ? encodeCursor(page.at(-1)?.id) : null,
    };
  }

  async getCustomer(input: {
    tenantId: string;
    customerId: string;
    allowedBranchIds: string[] | null;
  }) {
    const customer = await this.database.customer.findUnique({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.customerId } },
    });
    if (!customer || customer.archivedAt) return null;
    const access = await this.database.customerBranchAccess.findMany({
      where: {
        tenantId: input.tenantId,
        customerId: input.customerId,
        revokedAt: null,
        branchId: input.allowedBranchIds === null ? undefined : { in: input.allowedBranchIds },
      },
      select: { branchId: true },
      orderBy: { branchId: 'asc' },
    });
    if (input.allowedBranchIds !== null && access.length === 0) return null;
    const allAccess =
      input.allowedBranchIds === null
        ? access
        : await this.database.customerBranchAccess.findMany({
            where: { tenantId: input.tenantId, customerId: input.customerId, revokedAt: null },
            select: { branchId: true },
            orderBy: { branchId: 'asc' },
          });
    return { ...customer, branchIds: allAccess.map((item) => item.branchId) };
  }

  createCustomer(input: {
    tenantId: string;
    displayName: string;
    phoneNormalized?: string;
    emailNormalized?: string;
    note?: string;
    branchIds: string[];
    actorMembershipId: string;
    correlationId: string;
  }) {
    return runInTransaction(this.database, async (transaction) => {
      const branchCount = await transaction.branch.count({
        where: { tenantId: input.tenantId, id: { in: input.branchIds }, status: 'ACTIVE' },
      });
      if (branchCount !== input.branchIds.length) return null;
      const customer = await transaction.customer.create({
        data: {
          tenantId: input.tenantId,
          displayName: input.displayName,
          phoneNormalized: input.phoneNormalized,
          emailNormalized: input.emailNormalized,
          note: input.note,
          createdByMembershipId: input.actorMembershipId,
        },
      });
      await transaction.customerBranchAccess.createMany({
        data: input.branchIds.map((branchId) => ({
          tenantId: input.tenantId,
          customerId: customer.id,
          branchId,
          grantedByMembershipId: input.actorMembershipId,
        })),
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'BOOKING_CUSTOMER_CREATED',
          targetType: 'CUSTOMER',
          targetId: customer.id,
          reason: 'CUSTOMER_CREATED_BY_ACTOR',
          afterRedacted: {
            ...customerAuditSnapshot(customer),
            branchIds: input.branchIds,
          },
        },
      });
      await transaction.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'CUSTOMER',
          aggregateId: customer.id,
          eventType: 'booking.customer-created.v1',
          dedupeKey: `booking-customer-created:${customer.id}`,
          payloadRedacted: { customerId: customer.id, branchIds: input.branchIds },
          correlationId: input.correlationId,
        },
      });
      return { ...customer, branchIds: input.branchIds };
    });
  }

  updateCustomer(input: {
    tenantId: string;
    customerId: string;
    expectedStateVersion: number;
    displayName?: string;
    phoneNormalized?: string | null;
    emailNormalized?: string | null;
    note?: string | null;
    branchIds?: string[];
    actorMembershipId: string;
    correlationId: string;
    reason: string;
  }) {
    return runInTransaction(this.database, async (transaction) => {
      const before = await transaction.customer.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.customerId } },
      });
      if (!before || before.archivedAt) return null;
      if (input.branchIds) {
        const branchCount = await transaction.branch.count({
          where: { tenantId: input.tenantId, id: { in: input.branchIds }, status: 'ACTIVE' },
        });
        if (branchCount !== input.branchIds.length) return null;
      }
      const updated = await transaction.customer.updateMany({
        where: {
          tenantId: input.tenantId,
          id: input.customerId,
          stateVersion: input.expectedStateVersion,
          archivedAt: null,
        },
        data: {
          displayName: input.displayName,
          phoneNormalized: input.phoneNormalized,
          emailNormalized: input.emailNormalized,
          note: input.note,
          stateVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) return null;
      if (input.branchIds) {
        await transaction.customerBranchAccess.updateMany({
          where: {
            tenantId: input.tenantId,
            customerId: input.customerId,
            branchId: { notIn: input.branchIds },
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
        for (const branchId of input.branchIds) {
          await transaction.customerBranchAccess.upsert({
            where: {
              tenantId_customerId_branchId: {
                tenantId: input.tenantId,
                customerId: input.customerId,
                branchId,
              },
            },
            create: {
              tenantId: input.tenantId,
              customerId: input.customerId,
              branchId,
              grantedByMembershipId: input.actorMembershipId,
            },
            update: {
              revokedAt: null,
              grantedAt: new Date(),
              grantedByMembershipId: input.actorMembershipId,
            },
          });
        }
      }
      const customer = await transaction.customer.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.customerId } },
      });
      const branches = await transaction.customerBranchAccess.findMany({
        where: { tenantId: input.tenantId, customerId: input.customerId, revokedAt: null },
        select: { branchId: true },
        orderBy: { branchId: 'asc' },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'BOOKING_CUSTOMER_UPDATED',
          targetType: 'CUSTOMER',
          targetId: customer.id,
          reason: input.reason,
          beforeRedacted: customerAuditSnapshot(before),
          afterRedacted: {
            ...customerAuditSnapshot(customer),
            branchIds: branches.map((branch) => branch.branchId),
          },
        },
      });
      return { ...customer, branchIds: branches.map((branch) => branch.branchId) };
    });
  }

  getCustomerForBranch(tenantId: string, customerId: string, branchId: string) {
    return this.database.customerBranchAccess.findFirst({
      where: { tenantId, customerId, branchId, revokedAt: null },
    });
  }

  async listEffectiveServices(input: {
    tenantId: string;
    allowedBranchIds: string[] | null;
    branchId?: string;
    effectiveAt: Date;
  }) {
    const branchIds =
      input.branchId !== undefined
        ? [input.branchId]
        : input.allowedBranchIds === null
          ? undefined
          : input.allowedBranchIds;
    if (branchIds?.length === 0) return [];
    const availability = await this.database.serviceBranchAvailability.findMany({
      where: {
        tenantId: input.tenantId,
        branchId: branchIds ? { in: branchIds } : undefined,
        status: 'ACTIVE',
        effectiveFrom: { lte: input.effectiveAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveAt } }],
      },
      orderBy: [{ serviceOfferingVersionId: 'asc' }, { branchId: 'asc' }],
    });
    const versionIds = [...new Set(availability.map((item) => item.serviceOfferingVersionId))];
    const versions = await this.database.serviceOfferingVersion.findMany({
      where: {
        tenantId: input.tenantId,
        id: { in: versionIds },
        status: 'ACTIVE',
        effectiveFrom: { lte: input.effectiveAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveAt } }],
      },
      orderBy: [{ name: 'asc' }, { versionNumber: 'desc' }],
    });
    const offerings = await this.database.serviceOffering.findMany({
      where: {
        tenantId: input.tenantId,
        id: { in: versions.map((version) => version.serviceOfferingId) },
      },
    });
    return versions.map((version) => ({
      ...version,
      code:
        offerings.find((offering) => offering.id === version.serviceOfferingId)?.code ?? 'UNKNOWN',
      branchIds: availability
        .filter((item) => item.serviceOfferingVersionId === version.id)
        .map((item) => item.branchId),
    }));
  }

  async getEffectiveService(
    tenantId: string,
    serviceOfferingId: string,
    branchId: string,
    effectiveAt: Date,
  ) {
    const offering = await this.database.serviceOffering.findUnique({
      where: { tenantId_id: { tenantId, id: serviceOfferingId } },
    });
    if (!offering) return null;
    const version = await this.database.serviceOfferingVersion.findFirst({
      where: {
        tenantId,
        serviceOfferingId,
        status: 'ACTIVE',
        effectiveFrom: { lte: effectiveAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveAt } }],
      },
      orderBy: [{ versionNumber: 'desc' }, { id: 'desc' }],
    });
    if (!version) return null;
    const availability = await this.database.serviceBranchAvailability.findFirst({
      where: {
        tenantId,
        serviceOfferingId,
        serviceOfferingVersionId: version.id,
        branchId,
        status: 'ACTIVE',
        effectiveFrom: { lte: effectiveAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveAt } }],
      },
    });
    return availability ? { ...version, code: offering.code, branchId } : null;
  }

  async getEffectiveAssignment(
    tenantId: string,
    membershipId: string,
    branchId: string,
    effectiveAt: Date,
  ) {
    const membership = await this.database.tenantMembership.findUnique({
      where: { tenantId_id: { tenantId, id: membershipId } },
    });
    if (!membership || membership.status !== 'ACTIVE') return null;
    return this.database.assignment.findFirst({
      where: {
        tenantId,
        membershipId,
        branchId,
        status: 'ACTIVE',
        effectiveFrom: { lte: effectiveAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveAt } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
    });
  }

  async getPublishedFormVersion(
    tenantId: string,
    templateId: string,
    versionId: string,
    effectiveAt = new Date(),
  ) {
    const template = await this.database.formTemplate.findUnique({
      where: { tenantId_id: { tenantId, id: templateId } },
    });
    if (!template || template.status !== 'ACTIVE') return null;
    const version = await this.database.formVersion.findUnique({
      where: { tenantId_id: { tenantId, id: versionId } },
    });
    if (
      !version ||
      version.formTemplateId !== templateId ||
      version.status !== 'PUBLISHED' ||
      (version.effectiveFrom && version.effectiveFrom > effectiveAt)
    ) {
      return null;
    }
    return version;
  }

  findBookingConflict(input: {
    tenantId: string;
    branchId: string;
    assignedMembershipId: string;
    scheduledStartAt: Date;
    excludeBookingId?: string;
  }) {
    const lower = new Date(input.scheduledStartAt.getTime() - 60 * 60_000);
    const upper = new Date(input.scheduledStartAt.getTime() + 60 * 60_000);
    return this.database.booking.findFirst({
      where: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        assignedMembershipId: input.assignedMembershipId,
        id: input.excludeBookingId ? { not: input.excludeBookingId } : undefined,
        bookingType: 'SCHEDULED',
        status: { in: ['SCHEDULED', 'ARRIVED'] },
        scheduledStartAt: { gt: lower, lt: upper },
      },
      orderBy: [{ scheduledStartAt: 'asc' }, { id: 'asc' }],
    });
  }

  async getBookingTimezone(tenantId: string, branchId: string) {
    const [tenant, branch] = await Promise.all([
      this.database.tenant.findUnique({ where: { id: tenantId } }),
      this.database.branch.findUnique({ where: { tenantId_id: { tenantId, id: branchId } } }),
    ]);
    if (!tenant || !branch || branch.status !== 'ACTIVE') return null;
    return branch.timezoneOverride ?? tenant.timezone;
  }

  listBookings(input: BookingPageInput) {
    const branchIds =
      input.branchId !== undefined
        ? [input.branchId]
        : input.allowedBranchIds === null
          ? undefined
          : input.allowedBranchIds;
    if (branchIds?.length === 0) return Promise.resolve({ items: [], nextCursor: null });
    const cursorId = decodeCursor(input.cursor);
    return this.database.booking
      .findMany({
        where: {
          tenantId: input.tenantId,
          branchId: branchIds ? { in: branchIds } : undefined,
          businessDate: input.businessDate,
          status: input.status,
          assignedMembershipId: input.assignedMembershipId,
          id: cursorId ? { gt: cursorId } : undefined,
        },
        orderBy: { id: 'asc' },
        take: input.limit + 1,
      })
      .then((rows) => {
        const hasNext = rows.length > input.limit;
        const items = hasNext ? rows.slice(0, input.limit) : rows;
        return { items, nextCursor: hasNext ? encodeCursor(items.at(-1)?.id) : null };
      });
  }

  async getBooking(input: {
    tenantId: string;
    bookingId: string;
    allowedBranchIds: string[] | null;
  }) {
    const booking = await this.database.booking.findUnique({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.bookingId } },
    });
    if (
      !booking ||
      (input.allowedBranchIds !== null && !input.allowedBranchIds.includes(booking.branchId))
    ) {
      return null;
    }
    const transitions = await this.database.bookingStatusTransition.findMany({
      where: { tenantId: input.tenantId, bookingId: input.bookingId },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });
    return { ...booking, transitions };
  }

  createScheduledBooking(input: ScheduledBookingWrite) {
    return runInTransaction(this.database, async (transaction) => {
      const [
        customer,
        customerAccess,
        serviceVersion,
        serviceAvailability,
        membership,
        assignment,
        formTemplate,
        formVersion,
      ] = await Promise.all([
        transaction.customer.findUnique({
          where: { tenantId_id: { tenantId: input.tenantId, id: input.customerId } },
        }),
        transaction.customerBranchAccess.findFirst({
          where: {
            tenantId: input.tenantId,
            customerId: input.customerId,
            branchId: input.branchId,
            revokedAt: null,
          },
        }),
        transaction.serviceOfferingVersion.findUnique({
          where: {
            tenantId_id: {
              tenantId: input.tenantId,
              id: input.serviceOfferingVersionId,
            },
          },
        }),
        transaction.serviceBranchAvailability.findFirst({
          where: {
            tenantId: input.tenantId,
            serviceOfferingId: input.serviceOfferingId,
            serviceOfferingVersionId: input.serviceOfferingVersionId,
            branchId: input.branchId,
            status: 'ACTIVE',
            effectiveFrom: { lte: input.scheduledStartAt },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.scheduledStartAt } }],
          },
        }),
        transaction.tenantMembership.findUnique({
          where: {
            tenantId_id: {
              tenantId: input.tenantId,
              id: input.assignedMembershipId,
            },
          },
        }),
        transaction.assignment.findFirst({
          where: {
            tenantId: input.tenantId,
            membershipId: input.assignedMembershipId,
            branchId: input.branchId,
            status: 'ACTIVE',
            effectiveFrom: { lte: input.scheduledStartAt },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.scheduledStartAt } }],
          },
        }),
        transaction.formTemplate.findUnique({
          where: { tenantId_id: { tenantId: input.tenantId, id: input.formTemplateId } },
        }),
        transaction.formVersion.findUnique({
          where: { tenantId_id: { tenantId: input.tenantId, id: input.formVersionId } },
        }),
      ]);
      if (
        !customer ||
        customer.archivedAt ||
        !customerAccess ||
        !serviceVersion ||
        serviceVersion.serviceOfferingId !== input.serviceOfferingId ||
        serviceVersion.status !== 'ACTIVE' ||
        serviceVersion.effectiveFrom > input.scheduledStartAt ||
        (serviceVersion.effectiveTo !== null &&
          serviceVersion.effectiveTo <= input.scheduledStartAt) ||
        !serviceAvailability ||
        !membership ||
        membership.status !== 'ACTIVE' ||
        !assignment ||
        !formTemplate ||
        formTemplate.status !== 'ACTIVE' ||
        !formVersion ||
        formVersion.formTemplateId !== input.formTemplateId ||
        formVersion.status !== 'PUBLISHED' ||
        (formVersion.effectiveFrom !== null && formVersion.effectiveFrom > input.scheduledStartAt)
      ) {
        return null;
      }
      const submission = await transaction.formSubmission.create({
        data: {
          tenantId: input.tenantId,
          formTemplateId: input.formTemplateId,
          formVersionId: input.formVersionId,
          submittedByMembershipId: input.actorMembershipId,
          branchId: input.branchId,
          data: structuredClone(input.formData) as Prisma.InputJsonValue,
          idempotencyKey: `booking:${input.idempotencyKey}`,
        },
      });
      const booking = await transaction.booking.create({
        data: {
          tenantId: input.tenantId,
          branchId: input.branchId,
          customerId: input.customerId,
          serviceOfferingId: input.serviceOfferingId,
          serviceOfferingVersionId: input.serviceOfferingVersionId,
          serviceCodeSnapshot: input.serviceCodeSnapshot,
          serviceNameSnapshot: input.serviceNameSnapshot,
          assignedMembershipId: input.assignedMembershipId,
          formSubmissionId: submission.id,
          formVersionId: input.formVersionId,
          bookingType: 'SCHEDULED',
          scheduledStartAt: input.scheduledStartAt,
          businessDate: input.businessDate,
          timezoneSnapshot: input.timezoneSnapshot,
          status: 'SCHEDULED',
          createdByMembershipId: input.actorMembershipId,
        },
      });
      const sourceEventId = randomUUID();
      await transaction.bookingStatusTransition.create({
        data: {
          tenantId: input.tenantId,
          bookingId: booking.id,
          fromStatus: null,
          toStatus: 'SCHEDULED',
          actorMembershipId: input.actorMembershipId,
          sourceEventId,
          correlationId: input.correlationId,
          metadataRedacted: { formVersionId: input.formVersionId },
        },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'BOOKING_SCHEDULED',
          targetType: 'BOOKING',
          targetId: booking.id,
          reason: 'SCHEDULED_BOOKING_CREATED',
          afterRedacted: {
            bookingId: booking.id,
            branchId: booking.branchId,
            serviceOfferingId: booking.serviceOfferingId,
            assignedMembershipId: booking.assignedMembershipId,
            scheduledStartAt: booking.scheduledStartAt.toISOString(),
            formVersionId: booking.formVersionId,
          },
        },
      });
      await transaction.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'BOOKING',
          aggregateId: booking.id,
          eventType: 'booking.scheduled.v1',
          dedupeKey: `booking-scheduled:${booking.id}`,
          payloadRedacted: {
            bookingId: booking.id,
            branchId: booking.branchId,
            serviceOfferingId: booking.serviceOfferingId,
            assignedMembershipId: booking.assignedMembershipId,
            scheduledStartAt: booking.scheduledStartAt.toISOString(),
          },
          correlationId: input.correlationId,
        },
      });
      return booking;
    });
  }

  recordCustomerPhotoConsent(input: {
    tenantId: string;
    bookingId: string;
    actorMembershipId: string;
    method: 'VERBAL' | 'WRITTEN' | 'OTHER';
    policyVersionId: string;
    correlationId: string;
    recordedAt?: Date;
  }) {
    const recordedAt = input.recordedAt ?? new Date();
    return runInTransaction(this.database, async (transaction) => {
      const [booking, actor, policy] = await Promise.all([
        transaction.booking.findUnique({
          where: { tenantId_id: { tenantId: input.tenantId, id: input.bookingId } },
        }),
        transaction.tenantMembership.findUnique({
          where: {
            tenantId_id: {
              tenantId: input.tenantId,
              id: input.actorMembershipId,
            },
          },
        }),
        transaction.customerPhotoConsentPolicyVersion.findUnique({
          where: {
            tenantId_id: {
              tenantId: input.tenantId,
              id: input.policyVersionId,
            },
          },
        }),
      ]);
      if (!booking || !actor || actor.status !== 'ACTIVE') {
        throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy lịch hẹn.');
      }
      if (
        !policy ||
        policy.status !== 'ACTIVE' ||
        policy.effectiveFrom > recordedAt ||
        (policy.effectiveTo !== null && policy.effectiveTo <= recordedAt) ||
        !isAllowedConsentMethod(policy.allowedMethods, input.method)
      ) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'Chính sách hoặc phương thức đồng ý chụp ảnh không hợp lệ.',
        );
      }
      const consent = await transaction.customerPhotoConsent.create({
        data: {
          tenantId: input.tenantId,
          branchId: booking.branchId,
          bookingId: booking.id,
          customerId: booking.customerId,
          actorMembershipId: input.actorMembershipId,
          method: input.method,
          policyVersionId: policy.id,
          correlationId: input.correlationId,
          recordedAt,
        },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'CUSTOMER_PHOTO_CONSENT_RECORDED',
          targetType: 'CUSTOMER_PHOTO_CONSENT',
          targetId: consent.id,
          reason: 'CUSTOMER_CONSENT_RECORDED',
          afterRedacted: {
            bookingId: booking.id,
            branchId: booking.branchId,
            policyVersionId: policy.id,
            method: input.method,
          },
        },
      });
      return consent;
    });
  }

  createWalkInBooking(input: WalkInBookingWrite) {
    return runInTransaction(this.database, async (transaction) => {
      const [
        customer,
        customerAccess,
        serviceVersion,
        serviceAvailability,
        membership,
        assignment,
        formTemplate,
        formVersion,
        policy,
      ] = await Promise.all([
        transaction.customer.findUnique({
          where: { tenantId_id: { tenantId: input.tenantId, id: input.customerId } },
        }),
        transaction.customerBranchAccess.findFirst({
          where: {
            tenantId: input.tenantId,
            customerId: input.customerId,
            branchId: input.branchId,
            revokedAt: null,
          },
        }),
        transaction.serviceOfferingVersion.findUnique({
          where: {
            tenantId_id: {
              tenantId: input.tenantId,
              id: input.serviceOfferingVersionId,
            },
          },
        }),
        transaction.serviceBranchAvailability.findFirst({
          where: {
            tenantId: input.tenantId,
            serviceOfferingId: input.serviceOfferingId,
            serviceOfferingVersionId: input.serviceOfferingVersionId,
            branchId: input.branchId,
            status: 'ACTIVE',
            effectiveFrom: { lte: input.occurredAt },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.occurredAt } }],
          },
        }),
        transaction.tenantMembership.findUnique({
          where: {
            tenantId_id: {
              tenantId: input.tenantId,
              id: input.assignedMembershipId,
            },
          },
        }),
        transaction.assignment.findFirst({
          where: {
            tenantId: input.tenantId,
            membershipId: input.assignedMembershipId,
            branchId: input.branchId,
            status: 'ACTIVE',
            effectiveFrom: { lte: input.occurredAt },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.occurredAt } }],
          },
        }),
        transaction.formTemplate.findUnique({
          where: { tenantId_id: { tenantId: input.tenantId, id: input.formTemplateId } },
        }),
        transaction.formVersion.findUnique({
          where: { tenantId_id: { tenantId: input.tenantId, id: input.formVersionId } },
        }),
        transaction.customerPhotoConsentPolicyVersion.findUnique({
          where: {
            tenantId_id: {
              tenantId: input.tenantId,
              id: input.consentPolicyVersionId,
            },
          },
        }),
      ]);
      if (
        !customer ||
        customer.archivedAt ||
        !customerAccess ||
        !serviceVersion ||
        serviceVersion.serviceOfferingId !== input.serviceOfferingId ||
        serviceVersion.status !== 'ACTIVE' ||
        serviceVersion.effectiveFrom > input.occurredAt ||
        (serviceVersion.effectiveTo !== null && serviceVersion.effectiveTo <= input.occurredAt) ||
        !serviceAvailability ||
        !membership ||
        membership.status !== 'ACTIVE' ||
        !assignment ||
        !formTemplate ||
        formTemplate.status !== 'ACTIVE' ||
        !formVersion ||
        formVersion.formTemplateId !== input.formTemplateId ||
        formVersion.status !== 'PUBLISHED' ||
        (formVersion.effectiveFrom !== null && formVersion.effectiveFrom > input.occurredAt)
      ) {
        return null;
      }
      if (
        !policy ||
        policy.status !== 'ACTIVE' ||
        policy.effectiveFrom > input.occurredAt ||
        (policy.effectiveTo !== null && policy.effectiveTo <= input.occurredAt) ||
        !isAllowedConsentMethod(policy.allowedMethods, input.consentMethod)
      ) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'Chính sách đồng ý chụp ảnh không hợp lệ.',
        );
      }
      const submission = await transaction.formSubmission.create({
        data: {
          tenantId: input.tenantId,
          formTemplateId: input.formTemplateId,
          formVersionId: input.formVersionId,
          submittedByMembershipId: input.actorMembershipId,
          branchId: input.branchId,
          data: structuredClone(input.formData) as Prisma.InputJsonValue,
          idempotencyKey: `booking:${input.idempotencyKey}`,
        },
      });
      const booking = await transaction.booking.create({
        data: {
          tenantId: input.tenantId,
          branchId: input.branchId,
          customerId: input.customerId,
          serviceOfferingId: input.serviceOfferingId,
          serviceOfferingVersionId: input.serviceOfferingVersionId,
          serviceCodeSnapshot: input.serviceCodeSnapshot,
          serviceNameSnapshot: input.serviceNameSnapshot,
          assignedMembershipId: input.assignedMembershipId,
          formSubmissionId: submission.id,
          formVersionId: input.formVersionId,
          bookingType: 'WALK_IN',
          scheduledStartAt: input.occurredAt,
          businessDate: input.businessDate,
          timezoneSnapshot: input.timezoneSnapshot,
          status: 'ARRIVED',
          stateVersion: 1,
          createdByMembershipId: input.actorMembershipId,
        },
      });
      const consent = await transaction.customerPhotoConsent.create({
        data: {
          tenantId: input.tenantId,
          branchId: input.branchId,
          bookingId: booking.id,
          customerId: input.customerId,
          actorMembershipId: input.actorMembershipId,
          method: input.consentMethod,
          policyVersionId: input.consentPolicyVersionId,
          correlationId: input.correlationId,
          recordedAt: input.occurredAt,
        },
      });
      const sourceEventId = randomUUID();
      await transaction.bookingStatusTransition.create({
        data: {
          tenantId: input.tenantId,
          bookingId: booking.id,
          fromStatus: null,
          toStatus: 'ARRIVED',
          actorMembershipId: input.actorMembershipId,
          sourceEventId,
          correlationId: input.correlationId,
          metadataRedacted: { consentId: consent.id, walkIn: true },
          occurredAt: input.occurredAt,
        },
      });
      const debt = await openPhotoDebt(transaction, {
        tenantId: input.tenantId,
        bookingId: booking.id,
        branchId: booking.branchId,
        customerId: booking.customerId,
        ownerMembershipId: booking.assignedMembershipId,
        openedByMembershipId: input.actorMembershipId,
        openedReason: 'WALK_IN_ARRIVED_WITHOUT_CUSTOMER_PHOTO',
        businessDate: booking.businessDate,
        sourceEventId,
        correlationId: input.correlationId,
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'BOOKING_WALK_IN_ARRIVED',
          targetType: 'BOOKING',
          targetId: booking.id,
          reason: 'WALK_IN_CREATED_AND_ARRIVED',
          afterRedacted: {
            branchId: booking.branchId,
            assignedMembershipId: booking.assignedMembershipId,
            consentId: consent.id,
            photoDebtId: debt.id,
          },
        },
      });
      await transaction.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'BOOKING',
          aggregateId: booking.id,
          eventType: 'booking.arrived.v1',
          dedupeKey: `booking-arrived:${booking.id}`,
          payloadRedacted: {
            bookingId: booking.id,
            branchId: booking.branchId,
            customerId: booking.customerId,
            assignedMembershipId: booking.assignedMembershipId,
            consentId: consent.id,
            businessDate: booking.businessDate.toISOString().slice(0, 10),
            hasReadyCustomerPhoto: false,
          },
          correlationId: input.correlationId,
        },
      });
      return { booking, consentId: consent.id, photoDebt: debt };
    });
  }

  recordArrival(input: {
    tenantId: string;
    bookingId: string;
    actorMembershipId: string;
    consentId: string;
    customerPhotoMediaId?: string;
    expectedStateVersion: number;
    correlationId: string;
  }) {
    return runInTransaction(this.database, async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM bookings
        WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.bookingId}::uuid
        FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy lịch hẹn.');
      }
      const booking = await transaction.booking.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.bookingId } },
      });
      const consent = await transaction.customerPhotoConsent.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.consentId } },
      });
      if (
        !consent ||
        consent.bookingId !== booking.id ||
        consent.branchId !== booking.branchId ||
        consent.customerId !== booking.customerId
      ) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'Đồng ý chụp ảnh không thuộc lịch hẹn này.',
        );
      }
      const policy = await transaction.customerPhotoConsentPolicyVersion.findUnique({
        where: {
          tenantId_id: {
            tenantId: input.tenantId,
            id: consent.policyVersionId,
          },
        },
      });
      const now = new Date();
      if (
        !policy ||
        policy.status !== 'ACTIVE' ||
        policy.effectiveFrom > now ||
        (policy.effectiveTo !== null && policy.effectiveTo <= now)
      ) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'Đồng ý chụp ảnh không còn được chính sách hợp lệ xác nhận.',
        );
      }
      const photo = input.customerPhotoMediaId
        ? await transaction.mediaObject.findUnique({
            where: {
              tenantId_id: {
                tenantId: input.tenantId,
                id: input.customerPhotoMediaId,
              },
            },
          })
        : null;
      if (
        input.customerPhotoMediaId &&
        (!photo ||
          photo.status !== 'READY' ||
          photo.purpose !== 'CUSTOMER_BOOKING_PHOTO' ||
          photo.sourceType !== 'BOOKING' ||
          photo.sourceId !== booking.id ||
          photo.branchId !== booking.branchId ||
          photo.consentId !== consent.id)
      ) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'Ảnh khách chưa READY hoặc không thuộc lịch hẹn.',
        );
      }
      const decision = decideArrival({
        status: booking.status,
        stateVersion: booking.stateVersion,
        expectedStateVersion: input.expectedStateVersion,
        hasReadyCustomerPhoto: Boolean(photo),
      });
      if (booking.status === 'ARRIVED') {
        const existingDebt = await transaction.customerPhotoDebt.findUnique({
          where: {
            tenantId_bookingId: {
              tenantId: input.tenantId,
              bookingId: booking.id,
            },
          },
        });
        return { booking, consentId: consent.id, photoDebt: existingDebt };
      }
      const updated = await transaction.booking.update({
        where: { tenantId_id: { tenantId: input.tenantId, id: booking.id } },
        data: {
          status: decision.nextStatus,
          stateVersion: decision.nextStateVersion,
        },
      });
      const sourceEventId = randomUUID();
      await transaction.bookingStatusTransition.create({
        data: {
          tenantId: input.tenantId,
          bookingId: booking.id,
          fromStatus: booking.status,
          toStatus: 'ARRIVED',
          actorMembershipId: input.actorMembershipId,
          sourceEventId,
          correlationId: input.correlationId,
          evidenceMediaId: photo?.id,
          metadataRedacted: { consentId: consent.id, hasReadyCustomerPhoto: Boolean(photo) },
        },
      });
      const debt = decision.opensPhotoDebt
        ? await openPhotoDebt(transaction, {
            tenantId: input.tenantId,
            bookingId: booking.id,
            branchId: booking.branchId,
            customerId: booking.customerId,
            ownerMembershipId: booking.assignedMembershipId,
            openedByMembershipId: input.actorMembershipId,
            openedReason: 'ARRIVED_WITHOUT_CUSTOMER_PHOTO',
            businessDate: booking.businessDate,
            sourceEventId,
            correlationId: input.correlationId,
          })
        : null;
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'BOOKING_ARRIVED',
          targetType: 'BOOKING',
          targetId: booking.id,
          reason: 'CUSTOMER_ARRIVAL_RECORDED',
          beforeRedacted: { status: booking.status, stateVersion: booking.stateVersion },
          afterRedacted: {
            status: updated.status,
            stateVersion: updated.stateVersion,
            consentId: consent.id,
            hasReadyCustomerPhoto: Boolean(photo),
            photoDebtId: debt?.id ?? null,
          },
        },
      });
      await transaction.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'BOOKING',
          aggregateId: booking.id,
          eventType: 'booking.arrived.v1',
          dedupeKey: `booking-arrived:${booking.id}`,
          payloadRedacted: {
            bookingId: booking.id,
            branchId: booking.branchId,
            customerId: booking.customerId,
            assignedMembershipId: booking.assignedMembershipId,
            consentId: consent.id,
            businessDate: booking.businessDate.toISOString().slice(0, 10),
            hasReadyCustomerPhoto: Boolean(photo),
          },
          correlationId: input.correlationId,
        },
      });
      return { booking: updated, consentId: consent.id, photoDebt: debt };
    });
  }

  listPhotoDebts(input: {
    tenantId: string;
    allowedBranchIds: string[] | null;
    branchId?: string;
    state?: 'OPEN' | 'RESOLVED' | 'WAIVED';
    cursor?: string;
    limit: number;
  }) {
    const branchIds =
      input.branchId !== undefined
        ? [input.branchId]
        : input.allowedBranchIds === null
          ? undefined
          : input.allowedBranchIds;
    if (branchIds?.length === 0) return Promise.resolve({ items: [], nextCursor: null });
    const cursorId = decodeCursor(input.cursor);
    return this.database.customerPhotoDebt
      .findMany({
        where: {
          tenantId: input.tenantId,
          branchId: branchIds ? { in: branchIds } : undefined,
          state: input.state,
          id: cursorId ? { gt: cursorId } : undefined,
        },
        orderBy: { id: 'asc' },
        take: input.limit + 1,
      })
      .then((rows) => {
        const hasNext = rows.length > input.limit;
        const items = hasNext ? rows.slice(0, input.limit) : rows;
        return { items, nextCursor: hasNext ? encodeCursor(items.at(-1)?.id) : null };
      });
  }

  completeTour(input: {
    tenantId: string;
    bookingId: string;
    performedByMembershipId: string;
    customerPhotoMediaId: string;
    formSubmissionId?: string;
    expectedBookingStateVersion: number;
    correlationId: string;
  }) {
    return runInTransaction(this.database, async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM bookings
        WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.bookingId}::uuid
        FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy lịch hẹn.');
      }
      const booking = await transaction.booking.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.bookingId } },
      });
      const existing = await transaction.tourCompletion.findUnique({
        where: {
          tenantId_bookingId: {
            tenantId: input.tenantId,
            bookingId: input.bookingId,
          },
        },
      });
      if (existing && existing.supersededAt === null) {
        if (
          existing.customerPhotoMediaId !== input.customerPhotoMediaId ||
          existing.formSubmissionId !== (input.formSubmissionId ?? null) ||
          existing.performedByMembershipId !== input.performedByMembershipId
        ) {
          throw new ProblemError(409, 'CONFLICT', 'Tour đã được hoàn tất bằng bằng chứng khác.');
        }
        return existing;
      }
      const [photo, formSubmission] = await Promise.all([
        transaction.mediaObject.findUnique({
          where: {
            tenantId_id: {
              tenantId: input.tenantId,
              id: input.customerPhotoMediaId,
            },
          },
        }),
        input.formSubmissionId
          ? transaction.formSubmission.findUnique({
              where: {
                tenantId_id: {
                  tenantId: input.tenantId,
                  id: input.formSubmissionId,
                },
              },
            })
          : null,
      ]);
      const consent = photo?.consentId
        ? await transaction.customerPhotoConsent.findUnique({
            where: {
              tenantId_id: {
                tenantId: input.tenantId,
                id: photo.consentId,
              },
            },
          })
        : null;
      const hasReadyPhoto = Boolean(
        photo &&
        consent &&
        photo.status === 'READY' &&
        photo.purpose === 'CUSTOMER_BOOKING_PHOTO' &&
        photo.sourceType === 'BOOKING' &&
        photo.sourceId === booking.id &&
        photo.branchId === booking.branchId &&
        consent.bookingId === booking.id &&
        consent.branchId === booking.branchId &&
        consent.customerId === booking.customerId,
      );
      decideTourCompletion({
        status: booking.status,
        stateVersion: booking.stateVersion,
        expectedStateVersion: input.expectedBookingStateVersion,
        hasReadyCustomerPhoto: hasReadyPhoto,
      });
      if (
        input.formSubmissionId &&
        (!formSubmission || formSubmission.branchId !== booking.branchId)
      ) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'Biểu mẫu hoàn tất tour không thuộc lịch hẹn.',
        );
      }
      const sourceEventId = randomUUID();
      const completion = await transaction.tourCompletion.create({
        data: {
          tenantId: input.tenantId,
          branchId: booking.branchId,
          bookingId: booking.id,
          customerId: booking.customerId,
          performedByMembershipId: input.performedByMembershipId,
          serviceOfferingId: booking.serviceOfferingId,
          customerPhotoMediaId: input.customerPhotoMediaId,
          formSubmissionId: input.formSubmissionId,
          businessDate: booking.businessDate,
          sourceEventId,
        },
      });
      const debt = await transaction.customerPhotoDebt.findUnique({
        where: {
          tenantId_bookingId: {
            tenantId: input.tenantId,
            bookingId: booking.id,
          },
        },
      });
      if (debt?.state === 'OPEN') {
        const actionItem = await new ActionItemRepository(transaction).project({
          tenantId: input.tenantId,
          ownerMembershipId: debt.ownerMembershipId,
          branchId: debt.branchId,
          itemType: 'PHOTO_DEBT',
          sourceType: 'BOOKING_CUSTOMER_PHOTO_DEBT',
          sourceId: debt.id,
          businessDate: booking.businessDate,
          state: 'COMPLETED',
          title: 'Đã bổ sung ảnh khách cho lịch hẹn',
          targetValue: '1',
          actualValue: '1',
          remainingValue: '0',
          unit: 'PHOTO',
          deadlineAt: new Date(booking.businessDate.getTime() + 24 * 60 * 60_000 - 1),
          sourceFreshnessAt: completion.completedAt,
          deepLink: `adsup://bookings/${booking.id}/customer-photo`,
          eventId: sourceEventId,
          correlationId: input.correlationId,
        });
        await transaction.customerPhotoDebt.update({
          where: { tenantId_id: { tenantId: input.tenantId, id: debt.id } },
          data: {
            state: 'RESOLVED',
            stateVersion: { increment: 1 },
            resolvedMediaId: input.customerPhotoMediaId,
            resolvedByMembershipId: input.performedByMembershipId,
            resolvedAt: completion.completedAt,
            resolutionReason: 'TOUR_COMPLETED_WITH_READY_CUSTOMER_PHOTO',
            actionItemId: actionItem.id,
          },
        });
      }
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.performedByMembershipId,
          correlationId: input.correlationId,
          eventType: 'BOOKING_TOUR_COMPLETED',
          targetType: 'TOUR_COMPLETION',
          targetId: completion.id,
          reason: 'TOUR_COMPLETED_WITH_READY_CUSTOMER_PHOTO',
          afterRedacted: {
            bookingId: booking.id,
            branchId: booking.branchId,
            serviceOfferingId: booking.serviceOfferingId,
            customerPhotoMediaId: input.customerPhotoMediaId,
          },
        },
      });
      await transaction.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'BOOKING',
          aggregateId: booking.id,
          eventType: 'booking.tour-completed.v1',
          dedupeKey: `booking-tour-completed:${completion.id}`,
          payloadRedacted: {
            tourCompletionId: completion.id,
            bookingId: booking.id,
            branchId: booking.branchId,
            performedByMembershipId: input.performedByMembershipId,
            serviceOfferingId: booking.serviceOfferingId,
            businessDate: booking.businessDate.toISOString().slice(0, 10),
            completedAt: completion.completedAt.toISOString(),
          },
          correlationId: input.correlationId,
        },
      });
      return completion;
    });
  }

  getCompletedTours(input: {
    tenantId: string;
    membershipId: string;
    branchId: string;
    businessDate: Date;
    asOf: Date;
  }) {
    return this.database.tourCompletion.findMany({
      where: {
        tenantId: input.tenantId,
        performedByMembershipId: input.membershipId,
        branchId: input.branchId,
        businessDate: input.businessDate,
        completedAt: { lte: input.asOf },
        supersededAt: null,
      },
      select: { id: true, completedAt: true },
      orderBy: [{ completedAt: 'asc' }, { id: 'asc' }],
    });
  }

  createServiceOfferingVersion(input: BookingServiceVersionWrite) {
    return runInTransaction(this.database, async (transaction) => {
      const branches = await transaction.branch.findMany({
        where: {
          tenantId: input.tenantId,
          id: { in: [...new Set(input.branchIds)] },
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      if (branches.length !== new Set(input.branchIds).size) {
        throw new ProblemError(422, 'BUSINESS_RULE_VIOLATION', 'Service branch scope is invalid.');
      }
      const offering = input.serviceOfferingId
        ? await transaction.serviceOffering.findUnique({
            where: { tenantId_id: { tenantId: input.tenantId, id: input.serviceOfferingId } },
          })
        : await transaction.serviceOffering.findUnique({
            where: { tenantId_code: { tenantId: input.tenantId, code: input.code } },
          });
      const resolvedOffering =
        offering ??
        (await transaction.serviceOffering.create({
          data: {
            tenantId: input.tenantId,
            code: input.code,
            createdByMembershipId: input.actorMembershipId,
          },
        }));
      if (resolvedOffering.code !== input.code) {
        throw new ProblemError(409, 'CONFLICT', 'Service code does not match the offering.');
      }
      await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM service_offering_versions
        WHERE tenant_id = ${input.tenantId}::uuid
          AND service_offering_id = ${resolvedOffering.id}::uuid
        FOR UPDATE
      `;
      const previous = await transaction.serviceOfferingVersion.findFirst({
        where: { tenantId: input.tenantId, serviceOfferingId: resolvedOffering.id },
        orderBy: { versionNumber: 'desc' },
      });
      if (previous && input.effectiveFrom < previous.effectiveFrom) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'Service version dates must be monotonic.',
        );
      }
      await transaction.serviceOfferingVersion.updateMany({
        where: {
          tenantId: input.tenantId,
          serviceOfferingId: resolvedOffering.id,
          effectiveFrom: { lte: input.effectiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveFrom } }],
        },
        data: { effectiveTo: input.effectiveFrom },
      });
      await transaction.serviceBranchAvailability.updateMany({
        where: {
          tenantId: input.tenantId,
          serviceOfferingId: resolvedOffering.id,
          branchId: { in: input.branchIds },
          effectiveFrom: { lte: input.effectiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveFrom } }],
        },
        data: { effectiveTo: input.effectiveFrom, status: 'INACTIVE' },
      });
      const version = await transaction.serviceOfferingVersion.create({
        data: {
          tenantId: input.tenantId,
          serviceOfferingId: resolvedOffering.id,
          versionNumber: (previous?.versionNumber ?? 0) + 1,
          name: input.name,
          description: input.description,
          status: input.status,
          effectiveFrom: input.effectiveFrom,
          createdByMembershipId: input.actorMembershipId,
        },
      });
      await transaction.serviceBranchAvailability.createMany({
        data: input.branchIds.map((branchId) => ({
          tenantId: input.tenantId,
          serviceOfferingId: resolvedOffering.id,
          serviceOfferingVersionId: version.id,
          branchId,
          status: input.status,
          effectiveFrom: input.effectiveFrom,
        })),
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'BOOKING_SERVICE_VERSION_CREATED',
          targetType: 'SERVICE_OFFERING_VERSION',
          targetId: version.id,
          reason: 'BOOKING_SERVICE_CONFIGURATION_CHANGED',
          afterRedacted: {
            serviceOfferingId: version.serviceOfferingId,
            code: resolvedOffering.code,
            versionNumber: version.versionNumber,
            branchIds: input.branchIds,
            effectiveFrom: version.effectiveFrom,
          },
        },
      });
      await transaction.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'BOOKING_SERVICE',
          aggregateId: resolvedOffering.id,
          eventType: 'booking.service-version-created.v1',
          dedupeKey: `booking-service-version:${version.id}`,
          payloadRedacted: {
            serviceOfferingId: resolvedOffering.id,
            serviceOfferingVersionId: version.id,
            branchIds: input.branchIds,
            versionNumber: version.versionNumber,
          },
          correlationId: input.correlationId,
        },
      });
      return { ...version, code: resolvedOffering.code, branchIds: input.branchIds };
    });
  }

  createCustomerPhotoConsentPolicyVersion(input: CustomerPhotoConsentPolicyWrite) {
    return runInTransaction(this.database, async (transaction) => {
      await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM customer_photo_consent_policy_versions
        WHERE tenant_id = ${input.tenantId}::uuid
        FOR UPDATE
      `;
      const previous = await transaction.customerPhotoConsentPolicyVersion.findFirst({
        where: { tenantId: input.tenantId },
        orderBy: { versionNumber: 'desc' },
      });
      if (previous && input.effectiveFrom < previous.effectiveFrom) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'Consent policy dates must be monotonic.',
        );
      }
      await transaction.customerPhotoConsentPolicyVersion.updateMany({
        where: {
          tenantId: input.tenantId,
          effectiveFrom: { lte: input.effectiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveFrom } }],
        },
        data: { effectiveTo: input.effectiveFrom },
      });
      const version = await transaction.customerPhotoConsentPolicyVersion.create({
        data: {
          tenantId: input.tenantId,
          versionNumber: (previous?.versionNumber ?? 0) + 1,
          title: input.title,
          policyText: input.policyText,
          allowedMethods: input.allowedMethods as unknown as Prisma.InputJsonValue,
          status: input.status,
          effectiveFrom: input.effectiveFrom,
          createdByMembershipId: input.actorMembershipId,
        },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'BOOKING_CONSENT_POLICY_VERSION_CREATED',
          targetType: 'CUSTOMER_PHOTO_CONSENT_POLICY_VERSION',
          targetId: version.id,
          reason: 'BOOKING_CONSENT_POLICY_CHANGED',
          afterRedacted: {
            versionNumber: version.versionNumber,
            title: version.title,
            allowedMethods: input.allowedMethods,
            effectiveFrom: version.effectiveFrom,
          },
        },
      });
      return version;
    });
  }

  getEffectiveCustomerPhotoConsentPolicy(input: { tenantId: string; effectiveAt: Date }) {
    return this.database.customerPhotoConsentPolicyVersion.findFirst({
      where: {
        tenantId: input.tenantId,
        status: 'ACTIVE',
        effectiveFrom: { lte: input.effectiveAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveAt } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { versionNumber: 'desc' }],
    });
  }

  createBookingRetentionPolicyVersion(input: BookingRetentionPolicyWrite) {
    return runInTransaction(this.database, async (transaction) => {
      if (
        input.customerPhotoDays < 1 ||
        input.customerPhotoDays > 3650 ||
        input.xlsxDays < 1 ||
        input.xlsxDays > 365
      ) {
        throw new ProblemError(
          422,
          'VALIDATION_FAILED',
          'Retention policy exceeds platform bounds.',
        );
      }
      await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM booking_retention_policy_versions
        WHERE tenant_id = ${input.tenantId}::uuid
        FOR UPDATE
      `;
      const previous = await transaction.bookingRetentionPolicyVersion.findFirst({
        where: { tenantId: input.tenantId },
        orderBy: { versionNumber: 'desc' },
      });
      if (previous && input.effectiveFrom < previous.effectiveFrom) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'Retention policy dates must be monotonic.',
        );
      }
      await transaction.bookingRetentionPolicyVersion.updateMany({
        where: {
          tenantId: input.tenantId,
          effectiveFrom: { lte: input.effectiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveFrom } }],
        },
        data: { effectiveTo: input.effectiveFrom },
      });
      const version = await transaction.bookingRetentionPolicyVersion.create({
        data: {
          tenantId: input.tenantId,
          versionNumber: (previous?.versionNumber ?? 0) + 1,
          customerPhotoDays: input.customerPhotoDays,
          xlsxDays: input.xlsxDays,
          platformBoundsJson: { customerPhotoDaysMax: 3650, xlsxDaysMax: 365 },
          effectiveFrom: input.effectiveFrom,
          createdByMembershipId: input.actorMembershipId,
        },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'BOOKING_RETENTION_POLICY_VERSION_CREATED',
          targetType: 'BOOKING_RETENTION_POLICY_VERSION',
          targetId: version.id,
          reason: 'BOOKING_RETENTION_POLICY_CHANGED',
          afterRedacted: {
            versionNumber: version.versionNumber,
            customerPhotoDays: version.customerPhotoDays,
            xlsxDays: version.xlsxDays,
            effectiveFrom: version.effectiveFrom,
          },
        },
      });
      return version;
    });
  }

  getEffectiveBookingRetentionPolicy(input: { tenantId: string; effectiveAt: Date }) {
    return this.database.bookingRetentionPolicyVersion.findFirst({
      where: {
        tenantId: input.tenantId,
        effectiveFrom: { lte: input.effectiveAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveAt } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { versionNumber: 'desc' }],
    });
  }

  async getMediaRetentionScope(input: { tenantId: string; mediaId: string }) {
    return this.database.mediaObject.findUnique({
      where: { tenantId_id: { tenantId: input.tenantId, id: input.mediaId } },
      select: { id: true, tenantId: true, branchId: true, status: true, legalHoldAt: true },
    });
  }

  changeMediaLegalHold(input: {
    tenantId: string;
    mediaId: string;
    action: 'PLACE' | 'RELEASE';
    actorMembershipId: string;
    reason: string;
    correlationId: string;
  }) {
    return runInTransaction(this.database, async (transaction) => {
      const media = await transaction.mediaObject.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.mediaId } },
      });
      if (!media) throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Media was not found.');
      if (media.status === 'DELETED') {
        throw new ProblemError(409, 'CONFLICT', 'Deleted media cannot be restored by legal hold.');
      }
      const held = input.action === 'PLACE';
      const changedAt = new Date();
      const updated = await transaction.mediaObject.update({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.mediaId } },
        data: { legalHoldAt: held ? changedAt : null },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: held ? 'BOOKING_MEDIA_LEGAL_HOLD_PLACED' : 'BOOKING_MEDIA_LEGAL_HOLD_RELEASED',
          targetType: 'MEDIA_OBJECT',
          targetId: media.id,
          reason: input.reason,
          beforeRedacted: { held: media.legalHoldAt !== null },
          afterRedacted: { held },
        },
      });
      return { mediaId: updated.id, held, changedAt };
    });
  }

  listCancellationReasonVersions(input: { tenantId: string; effectiveAt: Date }) {
    return this.database.bookingCancellationReasonVersion
      .findMany({
        where: {
          tenantId: input.tenantId,
          status: 'ACTIVE',
          effectiveFrom: { lte: input.effectiveAt },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveAt } }],
        },
        orderBy: [{ reasonId: 'asc' }, { versionNumber: 'desc' }],
      })
      .then(async (rows) => {
        const latest = new Map<string, (typeof rows)[number]>();
        for (const row of rows) if (!latest.has(row.reasonId)) latest.set(row.reasonId, row);
        const reasons = await this.database.bookingCancellationReason.findMany({
          where: { tenantId: input.tenantId, id: { in: [...latest.keys()] } },
        });
        return [...latest.values()].map((row) => ({
          ...row,
          code: reasons.find((reason) => reason.id === row.reasonId)?.code ?? '',
        }));
      });
  }

  listBookingReportDestinations(input: { tenantId: string; effectiveAt?: Date }) {
    const effectiveAt = input.effectiveAt ?? new Date();
    return this.database.bookingReportDestination.findMany({
      where: {
        tenantId: input.tenantId,
        status: 'ACTIVE',
        effectiveFrom: { lte: effectiveAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveAt } }],
      },
      orderBy: [{ reportType: 'asc' }, { branchId: 'asc' }, { effectiveFrom: 'desc' }],
    });
  }

  replaceBookingReportDestinations(input: {
    tenantId: string;
    actorMembershipId: string;
    correlationId: string;
    items: Array<{
      branchId?: string;
      reportType: 'TOMORROW_SCHEDULE' | 'TODAY_OUTCOME';
      chatChannelId: string;
    }>;
  }) {
    return runInTransaction(this.database, async (transaction) => {
      const now = new Date();
      const unique = new Map(
        input.items.map((item) => [`${item.branchId ?? 'TENANT'}:${item.reportType}`, item]),
      );
      const items = [...unique.values()];
      for (const item of items) {
        const channel = await transaction.chatChannel.findUnique({
          where: { tenantId_id: { tenantId: input.tenantId, id: item.chatChannelId } },
        });
        if (
          !channel ||
          channel.status !== 'ACTIVE' ||
          (item.branchId ? channel.branchId !== item.branchId : channel.branchId !== null)
        ) {
          throw new ProblemError(
            422,
            'BUSINESS_RULE_VIOLATION',
            'Report channel is not compatible with the requested tenant or branch scope.',
          );
        }
        if (item.branchId) {
          const branch = await transaction.branch.findUnique({
            where: { tenantId_id: { tenantId: input.tenantId, id: item.branchId } },
          });
          if (!branch || branch.status !== 'ACTIVE') {
            throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Report branch was not found.');
          }
        }
      }
      for (const item of items) {
        await transaction.bookingReportDestination.updateMany({
          where: {
            tenantId: input.tenantId,
            branchId: item.branchId ?? null,
            reportType: item.reportType,
            status: 'ACTIVE',
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
          data: { effectiveTo: now, status: 'INACTIVE' },
        });
        const created = await transaction.bookingReportDestination.create({
          data: {
            tenantId: input.tenantId,
            branchId: item.branchId ?? null,
            reportType: item.reportType,
            chatChannelId: item.chatChannelId,
            status: 'ACTIVE',
            effectiveFrom: now,
            createdByMembershipId: input.actorMembershipId,
          },
        });
        await transaction.auditEvent.create({
          data: {
            tenantId: input.tenantId,
            actorMembershipId: input.actorMembershipId,
            correlationId: input.correlationId,
            eventType: 'BOOKING_REPORT_DESTINATION_REPLACED',
            targetType: 'BOOKING_REPORT_DESTINATION',
            targetId: created.id,
            reason: 'REPORT_DESTINATION_CONFIGURATION_CHANGED',
            afterRedacted: {
              branchId: item.branchId ?? null,
              reportType: item.reportType,
              chatChannelId: item.chatChannelId,
            },
          },
        });
      }
      return transaction.bookingReportDestination.findMany({
        where: {
          tenantId: input.tenantId,
          status: 'ACTIVE',
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
        orderBy: [{ reportType: 'asc' }, { branchId: 'asc' }, { effectiveFrom: 'desc' }],
      });
    });
  }

  createCancellationReasonVersion(input: CancellationReasonWrite) {
    return runInTransaction(this.database, async (transaction) => {
      const reason = input.reasonId
        ? await transaction.bookingCancellationReason.findUnique({
            where: { tenantId_id: { tenantId: input.tenantId, id: input.reasonId } },
          })
        : await transaction.bookingCancellationReason.create({
            data: {
              tenantId: input.tenantId,
              code: input.code,
              createdByMembershipId: input.actorMembershipId,
            },
          });
      if (!reason || (input.reasonId && reason.code !== input.code)) {
        throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Cancellation reason was not found.');
      }
      await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM booking_cancellation_reason_versions
        WHERE tenant_id = ${input.tenantId}::uuid AND reason_id = ${reason.id}::uuid
        FOR UPDATE
      `;
      const previous = await transaction.bookingCancellationReasonVersion.findFirst({
        where: { tenantId: input.tenantId, reasonId: reason.id },
        orderBy: { versionNumber: 'desc' },
      });
      if (previous && input.effectiveFrom < previous.effectiveFrom) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'A reason version cannot start before the latest version.',
        );
      }
      await transaction.bookingCancellationReasonVersion.updateMany({
        where: {
          tenantId: input.tenantId,
          reasonId: reason.id,
          effectiveFrom: { lte: input.effectiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveFrom } }],
        },
        data: { effectiveTo: input.effectiveFrom },
      });
      const version = await transaction.bookingCancellationReasonVersion.create({
        data: {
          tenantId: input.tenantId,
          reasonId: reason.id,
          versionNumber: (previous?.versionNumber ?? 0) + 1,
          label: input.label,
          appliesToCancellation: input.appliesToCancellation,
          appliesToReschedule: input.appliesToReschedule,
          status: input.status,
          effectiveFrom: input.effectiveFrom,
          createdByMembershipId: input.actorMembershipId,
        },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'BOOKING_CANCELLATION_REASON_VERSION_CREATED',
          targetType: 'BOOKING_CANCELLATION_REASON_VERSION',
          targetId: version.id,
          reason: 'BOOKING_REASON_CONFIGURATION_CHANGED',
          afterRedacted: {
            reasonId: reason.id,
            code: reason.code,
            versionNumber: version.versionNumber,
            label: version.label,
            status: version.status,
            effectiveFrom: version.effectiveFrom,
          },
        },
      });
      await transaction.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'BOOKING_CANCELLATION_REASON',
          aggregateId: reason.id,
          eventType: 'booking.cancellation-reason-version-created.v1',
          dedupeKey: `booking-reason-version:${version.id}`,
          payloadRedacted: {
            reasonId: reason.id,
            reasonVersionId: version.id,
            code: reason.code,
            versionNumber: version.versionNumber,
            status: version.status,
            effectiveFrom: version.effectiveFrom.toISOString(),
          },
          correlationId: input.correlationId,
        },
      });
      return { ...version, code: reason.code };
    });
  }

  recordBookingOutcome(input: {
    tenantId: string;
    bookingId: string;
    actorMembershipId: string;
    outcome: 'NO_SHOW' | 'CANCELLED';
    reasonVersionId: string;
    evidenceMediaId?: string;
    expectedStateVersion: number;
    correlationId: string;
  }) {
    return runInTransaction(this.database, async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM bookings
        WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.bookingId}::uuid
        FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Booking was not found.');
      }
      const booking = await transaction.booking.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.bookingId } },
      });
      const reasonVersion = await transaction.bookingCancellationReasonVersion.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.reasonVersionId } },
      });
      const reason = reasonVersion
        ? {
            ...reasonVersion,
            reason: await transaction.bookingCancellationReason.findUniqueOrThrow({
              where: { tenantId_id: { tenantId: input.tenantId, id: reasonVersion.reasonId } },
            }),
          }
        : null;
      const now = new Date();
      if (!reason || !resolveReasonVersion([reason], now, 'cancel')) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'Reason is not effective for cancellation.',
        );
      }
      const evidence = input.evidenceMediaId
        ? await transaction.mediaObject.findUnique({
            where: { tenantId_id: { tenantId: input.tenantId, id: input.evidenceMediaId } },
          })
        : null;
      if (input.evidenceMediaId && (!evidence || evidence.branchId !== booking.branchId)) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'Evidence is outside the booking branch.',
        );
      }
      const decision = decideBookingOutcome({
        status: booking.status,
        stateVersion: booking.stateVersion,
        expectedStateVersion: input.expectedStateVersion,
        outcome: input.outcome,
      });
      const updated = await transaction.booking.update({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.bookingId } },
        data: { status: decision.nextStatus, stateVersion: decision.nextStateVersion },
      });
      const sourceEventId = randomUUID();
      await transaction.bookingStatusTransition.create({
        data: {
          tenantId: input.tenantId,
          bookingId: booking.id,
          fromStatus: booking.status,
          toStatus: input.outcome,
          reasonVersionId: reason.id,
          reasonCodeSnapshot: reason.reason.code,
          reasonLabelSnapshot: reason.label,
          actorMembershipId: input.actorMembershipId,
          evidenceMediaId: evidence?.id,
          sourceEventId,
          correlationId: input.correlationId,
          occurredAt: now,
        },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'BOOKING_OUTCOME_RECORDED',
          targetType: 'BOOKING',
          targetId: booking.id,
          reason: 'BOOKING_TERMINAL_OUTCOME_RECORDED',
          beforeRedacted: { status: booking.status, stateVersion: booking.stateVersion },
          afterRedacted: {
            status: updated.status,
            stateVersion: updated.stateVersion,
            reasonVersionId: reason.id,
          },
        },
      });
      await transaction.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'BOOKING',
          aggregateId: booking.id,
          eventType: 'booking.outcome-recorded.v1',
          dedupeKey: `booking-outcome:${booking.id}:v${updated.stateVersion}`,
          payloadRedacted: {
            bookingId: booking.id,
            branchId: booking.branchId,
            outcome: updated.status,
            reasonVersionId: reason.id,
            reasonCode: reason.reason.code,
            stateVersion: updated.stateVersion,
          },
          correlationId: input.correlationId,
        },
      });
      return {
        ...updated,
        transitions: [
          await transaction.bookingStatusTransition.findFirstOrThrow({
            where: { tenantId: input.tenantId, sourceEventId },
          }),
        ],
      };
    });
  }

  rescheduleBooking(input: {
    tenantId: string;
    bookingId: string;
    actorMembershipId: string;
    scheduledStartAt: Date;
    assignedMembershipId: string;
    reasonVersionId: string;
    expectedStateVersion: number;
    correlationId: string;
  }) {
    return runInTransaction(this.database, async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM bookings
        WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.bookingId}::uuid
        FOR UPDATE
      `;
      if (locked.length === 0)
        throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Booking was not found.');
      const source = await transaction.booking.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.bookingId } },
      });
      const reasonVersion = await transaction.bookingCancellationReasonVersion.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.reasonVersionId } },
      });
      const reason = reasonVersion
        ? {
            ...reasonVersion,
            reason: await transaction.bookingCancellationReason.findUniqueOrThrow({
              where: { tenantId_id: { tenantId: input.tenantId, id: reasonVersion.reasonId } },
            }),
          }
        : null;
      if (!reason || !resolveReasonVersion([reason], new Date(), 'reschedule')) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'Reason is not effective for reschedule.',
        );
      }
      const decision = decideReschedule({
        status: source.status,
        stateVersion: source.stateVersion,
        expectedStateVersion: input.expectedStateVersion,
      });
      const assignment = await transaction.assignment.findFirst({
        where: {
          tenantId: input.tenantId,
          membershipId: input.assignedMembershipId,
          branchId: source.branchId,
          status: 'ACTIVE',
          effectiveFrom: { lte: input.scheduledStartAt },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.scheduledStartAt } }],
        },
      });
      if (!assignment)
        throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Assigned staff was not found.');
      const branch = await transaction.branch.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: source.branchId } },
      });
      const tenant = await transaction.tenant.findUnique({ where: { id: input.tenantId } });
      if (!branch || !tenant)
        throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Booking scope was not found.');
      const replacement = await transaction.booking.create({
        data: {
          tenantId: input.tenantId,
          branchId: source.branchId,
          customerId: source.customerId,
          serviceOfferingId: source.serviceOfferingId,
          serviceOfferingVersionId: source.serviceOfferingVersionId,
          serviceCodeSnapshot: source.serviceCodeSnapshot,
          serviceNameSnapshot: source.serviceNameSnapshot,
          assignedMembershipId: input.assignedMembershipId,
          formSubmissionId: source.formSubmissionId,
          formVersionId: source.formVersionId,
          bookingType: source.bookingType,
          scheduledStartAt: input.scheduledStartAt,
          businessDate: businessDateAt(
            input.scheduledStartAt,
            branch.timezoneOverride ?? tenant.timezone,
          ),
          timezoneSnapshot: branch.timezoneOverride ?? tenant.timezone,
          status: 'SCHEDULED',
          stateVersion: 1,
          rescheduledFromId: source.id,
          createdByMembershipId: input.actorMembershipId,
        },
      });
      const updated = await transaction.booking.update({
        where: { tenantId_id: { tenantId: input.tenantId, id: source.id } },
        data: {
          status: decision.nextStatus,
          stateVersion: decision.nextStateVersion,
          rescheduledToId: replacement.id,
        },
      });
      const sourceEventId = randomUUID();
      await transaction.bookingStatusTransition.create({
        data: {
          tenantId: input.tenantId,
          bookingId: source.id,
          fromStatus: source.status,
          toStatus: 'RESCHEDULED',
          reasonVersionId: reason.id,
          reasonCodeSnapshot: reason.reason.code,
          reasonLabelSnapshot: reason.label,
          actorMembershipId: input.actorMembershipId,
          sourceEventId,
          correlationId: input.correlationId,
          metadataRedacted: { replacementBookingId: replacement.id },
        },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'BOOKING_RESCHEDULED',
          targetType: 'BOOKING',
          targetId: source.id,
          reason: 'BOOKING_REPLACEMENT_CREATED',
          beforeRedacted: { status: source.status, stateVersion: source.stateVersion },
          afterRedacted: {
            status: updated.status,
            stateVersion: updated.stateVersion,
            replacementBookingId: replacement.id,
          },
        },
      });
      await transaction.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          aggregateType: 'BOOKING',
          aggregateId: source.id,
          eventType: 'booking.rescheduled.v1',
          dedupeKey: `booking-rescheduled:${source.id}:v${updated.stateVersion}`,
          payloadRedacted: {
            sourceBookingId: source.id,
            replacementBookingId: replacement.id,
            branchId: source.branchId,
            reasonVersionId: reason.id,
          },
          correlationId: input.correlationId,
        },
      });
      return { source: updated, replacement };
    });
  }

  correctBookingOutcome(input: {
    tenantId: string;
    bookingId: string;
    actorMembershipId: string;
    outcome: 'NO_SHOW' | 'CANCELLED';
    reasonVersionId: string;
    expectedStateVersion: number;
    correlationId: string;
  }) {
    return runInTransaction(this.database, async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM bookings
        WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.bookingId}::uuid
        FOR UPDATE
      `;
      if (locked.length === 0)
        throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Booking was not found.');
      const booking = await transaction.booking.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.bookingId } },
      });
      if (
        (booking.status !== 'NO_SHOW' && booking.status !== 'CANCELLED') ||
        booking.status === input.outcome
      ) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'Only a different terminal outcome can be corrected.',
        );
      }
      if (booking.stateVersion !== input.expectedStateVersion) {
        throw new ProblemError(409, 'CONFLICT', 'Booking state version has changed.');
      }
      const reasonVersion = await transaction.bookingCancellationReasonVersion.findUnique({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.reasonVersionId } },
      });
      const reason = reasonVersion
        ? {
            ...reasonVersion,
            reason: await transaction.bookingCancellationReason.findUniqueOrThrow({
              where: { tenantId_id: { tenantId: input.tenantId, id: reasonVersion.reasonId } },
            }),
          }
        : null;
      if (!reason || !resolveReasonVersion([reason], new Date(), 'cancel')) {
        throw new ProblemError(
          422,
          'BUSINESS_RULE_VIOLATION',
          'Correction reason is not effective.',
        );
      }
      const updated = await transaction.booking.update({
        where: { tenantId_id: { tenantId: input.tenantId, id: input.bookingId } },
        data: { status: input.outcome, stateVersion: { increment: 1 } },
      });
      const sourceEventId = randomUUID();
      await transaction.bookingStatusTransition.create({
        data: {
          tenantId: input.tenantId,
          bookingId: booking.id,
          fromStatus: booking.status,
          toStatus: input.outcome,
          reasonVersionId: reason.id,
          reasonCodeSnapshot: reason.reason.code,
          reasonLabelSnapshot: reason.label,
          actorMembershipId: input.actorMembershipId,
          sourceEventId,
          correlationId: input.correlationId,
          metadataRedacted: { correction: true },
        },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorMembershipId: input.actorMembershipId,
          correlationId: input.correlationId,
          eventType: 'BOOKING_OUTCOME_CORRECTED',
          targetType: 'BOOKING',
          targetId: booking.id,
          reason: 'PRIVILEGED_OUTCOME_CORRECTION',
          beforeRedacted: { status: booking.status, stateVersion: booking.stateVersion },
          afterRedacted: {
            status: updated.status,
            stateVersion: updated.stateVersion,
            reasonVersionId: reason.id,
          },
        },
      });
      return updated;
    });
  }
}
