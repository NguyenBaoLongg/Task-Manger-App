import { z } from 'zod';

export const attendanceContractVersion = '0.1.0' as const;

export const attendanceUuidSchema = z.string().uuid();
export const attendanceBusinessDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const attendanceReasonSchema = z.string().trim().min(3).max(1_000);
export const attendanceYearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/);

const vndMinor = z.coerce.bigint().nonnegative();
const optionalBusinessDate = attendanceBusinessDateSchema.optional();

export const selfScheduleRequestSchema = z
  .object({
    businessDate: attendanceBusinessDateSchema,
    shiftDefinitionId: attendanceUuidSchema,
    reason: attendanceReasonSchema.max(500).optional(),
  })
  .strict();

export const createOffCalendarRequestSchema = z
  .object({
    scopeType: z.enum(['TENANT', 'BRANCH']),
    branchId: attendanceUuidSchema.optional(),
    name: z.string().trim().min(1).max(200),
    startDate: attendanceBusinessDateSchema,
    endDate: attendanceBusinessDateSchema,
    reason: attendanceReasonSchema.max(500),
  })
  .strict();

export const createVideoPolicyRequestSchema = z
  .object({
    scopeType: z.enum(['TENANT', 'BRANCH']),
    branchId: attendanceUuidSchema.optional(),
    effectiveFromDate: attendanceBusinessDateSchema,
    effectiveToDate: attendanceBusinessDateSchema.nullable().optional(),
    requiresAcknowledgement: z.boolean(),
    requiresFullBody: z.boolean().default(true),
    requiresWorkArea: z.boolean().default(true),
    manualReviewRequired: z.boolean().default(true),
    acknowledgementText: z.string().trim().min(1).max(5_000).optional(),
    missingCheckinPenaltyMinor: vndMinor.default(50_000n),
    videoFailedPenaltyMinor: vndMinor.default(50_000n),
    currency: z.literal('VND').default('VND'),
    reason: attendanceReasonSchema.max(500),
  })
  .strict();

export const acknowledgeVideoPolicySchema = z
  .object({
    policyVersionId: attendanceUuidSchema,
    action: z.literal('ACKNOWLEDGED'),
    deviceId: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export const createCheckInRequestSchema = z
  .object({
    businessDate: attendanceBusinessDateSchema,
    mediaObjectId: attendanceUuidSchema,
  })
  .strict();

export const videoReviewRequestSchema = z
  .object({
    reviewStatus: z.enum(['PASSED', 'FAILED', 'WAIVED']),
    reason: attendanceReasonSchema.max(500),
    failedCriteria: z
      .array(z.enum(['FULL_BODY', 'UNIFORM', 'MAKEUP', 'HAIR', 'SHOES', 'WORK_AREA']))
      .optional(),
  })
  .strict();

export const workflowStepDefinitionSchema = z
  .object({
    mode: z.enum(['SEQUENTIAL', 'PARALLEL']),
    approverRule: z.enum(['DIRECT_MANAGER', 'TENANT_OWNER', 'ROLE_PERMISSION', 'EXPLICIT_MEMBERS']),
    requiredApprovalCount: z.number().int().min(1),
    permissionCode: z.string().trim().min(1).optional(),
    memberIds: z.array(attendanceUuidSchema).optional(),
  })
  .strict();

export const createWorkflowDefinitionRequestSchema = z
  .object({
    requestType: z.enum(['SHIFT_CHANGE', 'LATE_NOTICE', 'LEAVE_SCHEDULE', 'SUDDEN_LEAVE']),
    scopeType: z.enum(['TENANT', 'BRANCH']),
    branchId: attendanceUuidSchema.optional(),
    effectiveFromDate: optionalBusinessDate,
    effectiveToDate: attendanceBusinessDateSchema.nullable().optional(),
    steps: z.array(workflowStepDefinitionSchema).min(1),
    reason: attendanceReasonSchema.max(500),
  })
  .strict();

export const shiftChangeWorkflowPayloadSchema = z
  .object({
    businessDate: attendanceBusinessDateSchema,
    shiftDefinitionId: attendanceUuidSchema.optional(),
  })
  .strict();

export const lateNoticeWorkflowPayloadSchema = z
  .object({
    businessDate: attendanceBusinessDateSchema,
    noticeChannel: z.string().trim().min(1).max(100).optional(),
    noticeMessageRef: z.string().trim().min(1).max(500).optional(),
    notifiedAt: z.string().datetime().optional(),
  })
  .strict();

export const leaveExceptionEvidenceSchema = z
  .object({
    type: z.enum(['HOSPITAL_DOCUMENT', 'WEDDING_PHOTO', 'SPECIAL_APPROVAL']),
    mediaObjectId: attendanceUuidSchema.optional(),
    note: attendanceReasonSchema.max(500).optional(),
  })
  .strict();

const leaveDateRangeFields = {
  durationKind: z.enum(['FULL_DAY', 'MORNING_HALF', 'DATE_RANGE']),
  startDate: attendanceBusinessDateSchema,
  endDate: attendanceBusinessDateSchema,
} as const;

function validLeaveRange(
  value: { durationKind: string; startDate: string; endDate: string },
  ctx: z.RefinementCtx,
) {
  if (value.endDate < value.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'endDate must be on or after startDate',
    });
  }
  if (value.durationKind === 'MORNING_HALF' && value.startDate !== value.endDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'MORNING_HALF leave must start and end on the same date',
    });
  }
}

export const leaveScheduleWorkflowPayloadSchema = z
  .object({
    ...leaveDateRangeFields,
    exceptionEvidence: leaveExceptionEvidenceSchema.optional(),
  })
  .strict()
  .superRefine(validLeaveRange);

export const suddenLeaveWorkflowPayloadSchema = z
  .object({
    ...leaveDateRangeFields,
    notifiedCompanyChat: z.boolean(),
    noticeMessageRef: z.string().trim().min(1).max(500).optional(),
    exceptionEvidence: leaveExceptionEvidenceSchema.optional(),
  })
  .strict()
  .superRefine(validLeaveRange);

export const workflowPayloadByType = {
  SHIFT_CHANGE: shiftChangeWorkflowPayloadSchema,
  LATE_NOTICE: lateNoticeWorkflowPayloadSchema,
  LEAVE_SCHEDULE: leaveScheduleWorkflowPayloadSchema,
  SUDDEN_LEAVE: suddenLeaveWorkflowPayloadSchema,
} as const;

export function parseWorkflowPayload(
  requestType: keyof typeof workflowPayloadByType,
  payload: Record<string, unknown>,
) {
  return workflowPayloadByType[requestType].parse(payload);
}

export const submitApprovalRequestSchema = z
  .object({
    requestType: z.enum(['SHIFT_CHANGE', 'LATE_NOTICE', 'LEAVE_SCHEDULE', 'SUDDEN_LEAVE']),
    payload: z.record(z.string(), z.unknown()),
    reason: attendanceReasonSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const result = workflowPayloadByType[value.requestType].safeParse(value.payload);
    if (result.success) return;
    for (const issue of result.error.issues) {
      ctx.addIssue({ ...issue, path: ['payload', ...issue.path] });
    }
  });

export const approvalDecisionRequestSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'CANCEL']),
    reason: attendanceReasonSchema,
  })
  .strict();

export const createAttendancePenaltyPolicyRequestSchema = z
  .object({
    scopeType: z.enum(['TENANT', 'BRANCH']),
    branchId: attendanceUuidSchema.optional(),
    effectiveFromDate: attendanceBusinessDateSchema,
    effectiveToDate: attendanceBusinessDateSchema.nullable().optional(),
    lateFixed1To15Minor: vndMinor.default(20_000n),
    lateExcessPerMinuteMinor: vndMinor.default(2_000n),
    lateExcessAfterMinutes: z.number().int().min(0).default(15),
    lateMaxThresholdMinutes: z.number().int().min(1).default(90),
    lateMaxMinor: vndMinor.default(200_000n),
    lateNoNoticeMinor: vndMinor.default(100_000n),
    suddenLeaveNoNoticeMinor: vndMinor.default(50_000n),
    suddenLeaveOverLimitMinor: vndMinor.default(100_000n),
    leaveRuleViolationMinor: vndMinor.default(200_000n),
    monthlySuddenLeaveFreeDays: z.number().min(0).default(1),
    monthlyAbsenceNotifyThresholdDays: z.number().min(0).default(5),
    currency: z.literal('VND'),
    reason: attendanceReasonSchema.max(500),
  })
  .strict();

export const paymentTransitionRequestSchema = z
  .object({
    toStatus: z.enum(['SUBMITTED', 'CONFIRMED', 'REJECTED', 'WAIVED', 'REFUNDED']),
    amountMinor: vndMinor.optional(),
    mediaObjectId: attendanceUuidSchema.optional(),
    reason: attendanceReasonSchema,
  })
  .strict();

export const scheduleQuerySchema = z.object({
  branchId: attendanceUuidSchema.optional(),
  membershipId: attendanceUuidSchema.optional(),
  dateFrom: attendanceBusinessDateSchema,
  dateTo: attendanceBusinessDateSchema,
  cursor: z.string().trim().min(1).max(500).optional(),
});

export const monthlySummaryQuerySchema = z.object({
  yearMonth: attendanceYearMonthSchema,
  branchId: attendanceUuidSchema.optional(),
  overThreshold: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  cursor: z.string().trim().min(1).max(500).optional(),
});

export const penaltySettlementQuerySchema = z.object({
  yearMonth: attendanceYearMonthSchema,
  branchId: attendanceUuidSchema.optional(),
  cursor: z.string().trim().min(1).max(500).optional(),
});
