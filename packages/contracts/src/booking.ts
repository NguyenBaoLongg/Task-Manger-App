import { z } from 'zod';

const uuid = z.string().uuid();
const date = z.string().date();
const dateTime = z.string().datetime({ offset: true });
const cursor = z.string().trim().min(1).max(500);
const pageLimit = z.coerce.number().int().min(1).max(100).default(20);

export const bookingTypeSchema = z.enum(['SCHEDULED', 'WALK_IN']);
export const bookingStatusSchema = z.enum([
  'SCHEDULED',
  'ARRIVED',
  'NO_SHOW',
  'CANCELLED',
  'RESCHEDULED',
]);
export const bookingReportTypeSchema = z.enum(['TOMORROW_SCHEDULE', 'TODAY_OUTCOME']);
export const bookingConfigStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export const consentMethodSchema = z.enum(['VERBAL', 'WRITTEN', 'OTHER']);
export const createBookingServiceVersionSchema = z
  .object({
    serviceOfferingId: uuid.optional(),
    code: z.string().regex(/^[A-Z0-9_]{2,50}$/),
    name: z.string().trim().min(1).max(160),
    description: z.string().max(1_000).optional(),
    branchIds: z.array(uuid).min(1).max(500),
    status: bookingConfigStatusSchema.default('ACTIVE'),
    effectiveFrom: dateTime,
  })
  .strict()
  .superRefine((input, context) => {
    if (new Set(input.branchIds).size !== input.branchIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['branchIds'],
        message: 'branchIds must be unique',
      });
    }
  });
export const serviceOfferingVersionSchema = z
  .object({
    id: uuid,
    serviceOfferingId: uuid,
    code: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    versionNumber: z.number().int().positive(),
    branchIds: z.array(uuid),
    status: bookingConfigStatusSchema,
    effectiveFrom: dateTime,
    effectiveTo: dateTime.nullable().optional(),
  })
  .strict();
export const createCustomerPhotoConsentPolicySchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    policyText: z.string().trim().min(1).max(10_000),
    allowedMethods: z.array(consentMethodSchema).min(1).max(3),
    status: bookingConfigStatusSchema.default('ACTIVE'),
    effectiveFrom: dateTime,
  })
  .strict()
  .superRefine((input, context) => {
    if (new Set(input.allowedMethods).size !== input.allowedMethods.length) {
      context.addIssue({
        code: 'custom',
        path: ['allowedMethods'],
        message: 'allowedMethods must be unique',
      });
    }
  });
export const customerPhotoConsentPolicySchema = z
  .object({
    id: uuid,
    versionNumber: z.number().int().positive(),
    title: z.string(),
    policyText: z.string(),
    allowedMethods: z.array(consentMethodSchema),
    status: bookingConfigStatusSchema,
    effectiveFrom: dateTime,
    effectiveTo: dateTime.nullable().optional(),
  })
  .strict();
export const createBookingRetentionPolicySchema = z
  .object({
    customerPhotoDays: z.number().int().min(1).max(3650).default(180),
    xlsxDays: z.number().int().min(1).max(365).default(30),
    effectiveFrom: dateTime,
  })
  .strict();
export const bookingRetentionPolicySchema = z
  .object({
    id: uuid,
    versionNumber: z.number().int().positive(),
    customerPhotoDays: z.number().int().min(1).max(3650),
    xlsxDays: z.number().int().min(1).max(365),
    effectiveFrom: dateTime,
    effectiveTo: dateTime.nullable().optional(),
  })
  .strict();
export const changeBookingMediaLegalHoldSchema = z
  .object({ action: z.enum(['PLACE', 'RELEASE']), reason: z.string().trim().min(3).max(500) })
  .strict();
export const legalHoldResultSchema = z
  .object({ mediaId: uuid, held: z.boolean(), changedAt: dateTime })
  .strict();
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

export const updateCustomerSchema = z
  .object({
    displayName: z.string().trim().min(1).max(160).optional(),
    phone: z.string().trim().min(6).max(30).nullable().optional(),
    email: z.email().max(254).nullable().optional(),
    note: z.string().max(1_000).nullable().optional(),
    branchIds: z.array(uuid).min(1).max(100).optional(),
    expectedStateVersion: z.number().int().positive(),
  })
  .strict()
  .refine(
    (input) =>
      input.displayName !== undefined ||
      input.phone !== undefined ||
      input.email !== undefined ||
      input.note !== undefined ||
      input.branchIds !== undefined,
    { message: 'At least one customer field must be updated' },
  );

export const customerQuerySchema = z
  .object({
    branchId: uuid.optional(),
    cursor: cursor.optional(),
    limit: pageLimit,
  })
  .strict();

export const effectiveServiceQuerySchema = z
  .object({
    branchId: uuid.optional(),
    effectiveAt: dateTime.optional(),
  })
  .strict();

export const bookingQuerySchema = z
  .object({
    branchId: uuid.optional(),
    businessDate: date.optional(),
    status: bookingStatusSchema.optional(),
    assignedMembershipId: uuid.optional(),
    cursor: cursor.optional(),
    limit: pageLimit,
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

export const createCustomerPhotoUploadIntentSchema = z
  .object({
    consentId: uuid,
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    byteSize: z
      .number()
      .int()
      .positive()
      .max(25 * 1024 * 1024),
    checksumSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  })
  .strict();

export const createWalkInBookingSchema = z
  .object({
    branchId: uuid,
    customerId: uuid,
    serviceOfferingId: uuid,
    assignedMembershipId: uuid,
    consentMethod: consentMethodSchema,
    consentPolicyVersionId: uuid,
    formTemplateId: uuid,
    formVersionId: uuid,
    formData: z.record(z.string(), z.unknown()),
  })
  .strict();

export const recordArrivalSchema = z
  .object({
    consentId: uuid,
    customerPhotoMediaId: uuid.optional(),
    expectedStateVersion: z.number().int().positive(),
  })
  .strict();

export const completeTourSchema = z
  .object({
    customerPhotoMediaId: uuid,
    formSubmissionId: uuid.optional(),
    expectedBookingStateVersion: z.number().int().positive(),
  })
  .strict();

export const createCancellationReasonSchema = z
  .object({
    reasonId: uuid.optional(),
    code: z.string().regex(/^[A-Z0-9_]{2,50}$/),
    label: z.string().trim().min(1).max(160),
    appliesToCancellation: z.boolean(),
    appliesToReschedule: z.boolean(),
    status: bookingConfigStatusSchema.default('ACTIVE'),
    effectiveFrom: dateTime,
  })
  .strict();

export const cancellationReasonVersionSchema = z
  .object({
    id: uuid,
    reasonId: uuid,
    code: z.string(),
    label: z.string(),
    versionNumber: z.number().int().positive(),
    appliesToCancellation: z.boolean(),
    appliesToReschedule: z.boolean(),
    status: bookingConfigStatusSchema,
    effectiveFrom: dateTime,
    effectiveTo: dateTime.nullable().optional(),
  })
  .strict();

export const recordBookingOutcomeSchema = z
  .object({
    outcome: z.enum(['NO_SHOW', 'CANCELLED']),
    reasonVersionId: uuid,
    evidenceMediaId: uuid.optional(),
    expectedStateVersion: z.number().int().positive(),
  })
  .strict();

export const rescheduleBookingSchema = z
  .object({
    scheduledStartAt: dateTime,
    assignedMembershipId: uuid,
    reasonVersionId: uuid,
    expectedStateVersion: z.number().int().positive(),
  })
  .strict();

export const photoDebtQuerySchema = z
  .object({
    branchId: uuid.optional(),
    state: z.enum(['OPEN', 'RESOLVED', 'WAIVED']).optional(),
    cursor: cursor.optional(),
    limit: pageLimit,
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
    for (const [name, values] of [
      ['dataTypes', input.dataTypes],
      ['branchIds', input.branchIds],
      ['departmentIds', input.departmentIds ?? []],
      ['membershipIds', input.membershipIds ?? []],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: 'custom',
          path: [name],
          message: `${name} must contain unique values`,
        });
      }
    }
  });

export const exportSchema = z
  .object({
    id: uuid,
    format: z.literal('XLSX'),
    dataTypes: z.array(exportDataTypeSchema),
    dateFrom: date,
    dateTo: date,
    branchIds: z.array(uuid),
    state: exportStateSchema,
    progressRows: z.number().int().nonnegative(),
    byteSize: z.number().int().nonnegative().nullable().optional(),
    checksumSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable()
      .optional(),
    expiresAt: dateTime.nullable().optional(),
    safeErrorCode: z.string().nullable().optional(),
    createdAt: dateTime,
  })
  .strict();

export const exportPageSchema = z
  .object({ items: z.array(exportSchema), nextCursor: cursor.nullable().optional() })
  .strict();

export const signedDownloadSchema = z.object({ url: z.url(), expiresAt: dateTime }).strict();

export const bookingReportDestinationInputSchema = z
  .object({
    branchId: uuid.optional(),
    reportType: bookingReportTypeSchema,
    chatChannelId: uuid,
  })
  .strict();

export const replaceBookingReportDestinationsSchema = z
  .object({ items: z.array(bookingReportDestinationInputSchema).max(100) })
  .strict();

export const bookingReportDestinationSchema = bookingReportDestinationInputSchema.extend({
  id: uuid,
  status: bookingConfigStatusSchema.default('ACTIVE'),
  effectiveFrom: dateTime,
  effectiveTo: dateTime.nullable().optional(),
});

export const rerunBookingReportSchema = z
  .object({
    reportType: bookingReportTypeSchema,
    businessDate: date,
    branchIds: z.array(uuid).max(500).optional(),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export const bookingJobRunSchema = z
  .object({
    id: uuid,
    jobType: z.string().min(1),
    businessDate: date,
    state: z.enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'RETRYABLE', 'FAILED']),
    attempt: z.number().int().nonnegative(),
  })
  .strict();

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

export const bookingArrivedEventSchema = bookingEventEnvelopeSchema.extend({
  eventType: z.literal('booking.arrived.v1'),
  payload: z
    .object({
      bookingId: uuid,
      branchId: uuid,
      customerId: uuid,
      assignedMembershipId: uuid,
      consentId: uuid,
      businessDate: date,
      hasReadyCustomerPhoto: z.boolean(),
    })
    .strict(),
});

export const bookingPhotoDebtChangedEventSchema = bookingEventEnvelopeSchema.extend({
  eventType: z.literal('booking.photo-debt-changed.v1'),
  payload: z
    .object({
      debtId: uuid,
      bookingId: uuid,
      branchId: uuid,
      ownerMembershipId: uuid,
      fromState: z.enum(['OPEN', 'RESOLVED', 'WAIVED']).nullable(),
      toState: z.enum(['OPEN', 'RESOLVED', 'WAIVED']),
      actionItemId: uuid.nullable(),
      businessDate: date,
    })
    .strict(),
});

export const bookingCustomerPhotoReadyEventSchema = bookingEventEnvelopeSchema.extend({
  eventType: z.literal('booking.customer-photo-ready.v1'),
  payload: z
    .object({
      bookingId: uuid,
      branchId: uuid,
      customerId: uuid,
      mediaId: uuid,
      photoDebtId: uuid.optional(),
    })
    .strict(),
});

export const bookingTourCompletedEventSchema = bookingEventEnvelopeSchema.extend({
  eventType: z.literal('booking.tour-completed.v1'),
  payload: z
    .object({
      tourCompletionId: uuid,
      bookingId: uuid,
      branchId: uuid,
      performedByMembershipId: uuid,
      serviceOfferingId: uuid,
      businessDate: date,
      completedAt: dateTime,
    })
    .strict(),
});

export const bookingReportReadyEventSchema = bookingEventEnvelopeSchema.extend({
  eventType: z.literal('booking.report-ready.v1'),
  payload: z
    .object({
      reportRunId: uuid,
      reportType: bookingReportTypeSchema,
      businessDate: date,
      branchScope: z.array(uuid),
      contentHash: z.string().regex(/^[A-Fa-f0-9]{64}$/),
      destinationCount: z.number().int().nonnegative(),
    })
    .strict(),
});

export type BookingType = z.infer<typeof bookingTypeSchema>;
export type BookingStatus = z.infer<typeof bookingStatusSchema>;
export type BookingReportType = z.infer<typeof bookingReportTypeSchema>;
export type ConsentMethod = z.infer<typeof consentMethodSchema>;
export type ExportState = z.infer<typeof exportStateSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerQuery = z.infer<typeof customerQuerySchema>;
export type EffectiveServiceQuery = z.infer<typeof effectiveServiceQuerySchema>;
export type BookingQuery = z.infer<typeof bookingQuerySchema>;
export type CreateScheduledBookingInput = z.infer<typeof createScheduledBookingSchema>;
export type CreateCustomerPhotoConsentInput = z.infer<typeof createCustomerPhotoConsentSchema>;
export type CreateCustomerPhotoUploadIntentInput = z.infer<
  typeof createCustomerPhotoUploadIntentSchema
>;
export type CreateWalkInBookingInput = z.infer<typeof createWalkInBookingSchema>;
export type RecordArrivalInput = z.infer<typeof recordArrivalSchema>;
export type CompleteTourInput = z.infer<typeof completeTourSchema>;
export type CreateCancellationReasonInput = z.infer<typeof createCancellationReasonSchema>;
export type RecordBookingOutcomeInput = z.infer<typeof recordBookingOutcomeSchema>;
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;
export type PhotoDebtQuery = z.infer<typeof photoDebtQuerySchema>;
export type CreateExportInput = z.infer<typeof createExportSchema>;
export type ExportResponse = z.infer<typeof exportSchema>;
export type ExportPage = z.infer<typeof exportPageSchema>;
export type SignedDownload = z.infer<typeof signedDownloadSchema>;
export type BookingReportDestinationInput = z.infer<typeof bookingReportDestinationInputSchema>;
export type ReplaceBookingReportDestinationsInput = z.infer<
  typeof replaceBookingReportDestinationsSchema
>;
export type RerunBookingReportInput = z.infer<typeof rerunBookingReportSchema>;
export type CreateBookingServiceVersionInput = z.infer<typeof createBookingServiceVersionSchema>;
export type CreateCustomerPhotoConsentPolicyInput = z.infer<
  typeof createCustomerPhotoConsentPolicySchema
>;
export type CreateBookingRetentionPolicyInput = z.infer<typeof createBookingRetentionPolicySchema>;
export type ChangeBookingMediaLegalHoldInput = z.infer<typeof changeBookingMediaLegalHoldSchema>;
