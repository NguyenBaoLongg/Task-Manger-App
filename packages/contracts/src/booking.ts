import { z } from 'zod';

const uuid = z.string().uuid();
const date = z.string().date();
const dateTime = z.string().datetime({ offset: true });

export const bookingTypeSchema = z.enum(['SCHEDULED', 'WALK_IN']);
export const bookingStatusSchema = z.enum([
  'SCHEDULED',
  'ARRIVED',
  'NO_SHOW',
  'CANCELLED',
  'RESCHEDULED',
]);
export const bookingReportTypeSchema = z.enum(['TOMORROW_SCHEDULE', 'TODAY_OUTCOME']);
export const consentMethodSchema = z.enum(['VERBAL', 'WRITTEN', 'OTHER']);
export const exportStateSchema = z.enum([
  'PENDING',
  'RUNNING',
  'READY',
  'RETRYABLE',
  'FAILED',
  'EXPIRED',
]);

export const createCustomerSchema = z
  .object({
    displayName: z.string().trim().min(1).max(160),
    phone: z.string().trim().min(6).max(30).optional(),
    email: z.email().max(254).optional(),
    note: z.string().max(1_000).optional(),
    branchIds: z.array(uuid).min(1).max(100),
  })
  .strict();

export const createScheduledBookingSchema = z
  .object({
    branchId: uuid,
    customerId: uuid,
    serviceOfferingId: uuid,
    assignedMembershipId: uuid,
    scheduledStartAt: dateTime,
    formTemplateId: uuid,
    formVersionId: uuid,
    formData: z.record(z.string(), z.unknown()),
  })
  .strict();

export const createCustomerPhotoConsentSchema = z
  .object({
    method: consentMethodSchema,
    policyVersionId: uuid,
  })
  .strict();

export const exportDataTypeSchema = z.enum([
  'BOOKINGS',
  'TOURS',
  'KPI',
  'PENALTIES',
  'ACTION_ITEMS',
]);

export const createExportSchema = z
  .object({
    format: z.literal('XLSX'),
    dataTypes: z.array(exportDataTypeSchema).min(1).max(5),
    dateFrom: date,
    dateTo: date,
    branchIds: z.array(uuid).min(1).max(500),
    departmentIds: z.array(uuid).max(500).optional(),
    membershipIds: z.array(uuid).max(1_000).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.dateTo < input.dateFrom) {
      context.addIssue({
        code: 'custom',
        path: ['dateTo'],
        message: 'dateTo must not be before dateFrom',
      });
    }
  });

export const bookingEventEnvelopeSchema = z
  .object({
    eventId: uuid,
    eventType: z.string().regex(/^booking\.[a-z-]+\.v\d+$/),
    schemaVersion: z.number().int().positive(),
    tenantId: uuid,
    branchId: uuid.nullable(),
    aggregateType: z.literal('BOOKING'),
    aggregateId: uuid,
    occurredAt: dateTime,
    correlationId: z.string().min(1).max(100),
    actorMembershipId: uuid.nullable(),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();

export type BookingType = z.infer<typeof bookingTypeSchema>;
export type BookingStatus = z.infer<typeof bookingStatusSchema>;
export type BookingReportType = z.infer<typeof bookingReportTypeSchema>;
export type ConsentMethod = z.infer<typeof consentMethodSchema>;
export type ExportState = z.infer<typeof exportStateSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CreateScheduledBookingInput = z.infer<typeof createScheduledBookingSchema>;
export type CreateCustomerPhotoConsentInput = z.infer<
  typeof createCustomerPhotoConsentSchema
>;
export type CreateExportInput = z.infer<typeof createExportSchema>;
