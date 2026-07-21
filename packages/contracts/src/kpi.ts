import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const businessDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const exactIntegerSchema = z.string().regex(/^-?(?:0|[1-9][0-9]*)$/);
export const exactValueSchema = z.object({
  value: z.string().regex(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]{1,4})?$/),
  unit: z.string().min(1).max(16),
});
export const reasonSchema = z.string().trim().min(3).max(500);
export const localTimeSchema = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/);

export const createKpiDefinitionSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{1,79}$/),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1_000).optional(),
  valueType: z.enum(['MONEY', 'COUNT', 'PERCENTAGE']),
  unit: z.string().trim().min(1).max(16),
  direction: z.enum(['AT_LEAST', 'AT_MOST']),
  sourceType: z.enum(['FORM_FIELD', 'DOMAIN_ADAPTER']),
  reason: reasonSchema,
});

export const createTargetVersionSchema = z
  .object({
    kpiDefinitionId: uuidSchema,
    scopeType: z.enum(['TENANT', 'BRANCH', 'DEPARTMENT', 'GROUP', 'MEMBERSHIP']),
    scopeId: uuidSchema.nullable().optional(),
    target: exactValueSchema,
    required: z.boolean(),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().nullable().optional(),
    reason: reasonSchema,
  })
  .superRefine((value, context) => {
    if (value.scopeType === 'TENANT' && value.scopeId) {
      context.addIssue({
        code: 'custom',
        path: ['scopeId'],
        message: 'Tenant scope không có scopeId.',
      });
    }
    if (value.scopeType !== 'TENANT' && !value.scopeId) {
      context.addIssue({ code: 'custom', path: ['scopeId'], message: 'Scope này cần scopeId.' });
    }
    if (value.effectiveTo && value.effectiveTo <= value.effectiveFrom) {
      context.addIssue({
        code: 'custom',
        path: ['effectiveTo'],
        message: 'Khoảng hiệu lực không hợp lệ.',
      });
    }
  });

export const createSourceMappingSchema = z
  .object({
    kpiDefinitionId: uuidSchema,
    sourceType: z.enum(['FORM_FIELD', 'DOMAIN_ADAPTER']),
    formTemplateId: uuidSchema.nullable().optional(),
    formVersionId: uuidSchema.nullable().optional(),
    jsonPointer: z.string().regex(/^\//).nullable().optional(),
    adapterCode: z.string().min(1).max(80).nullable().optional(),
    aggregation: z.enum(['LATEST', 'SUM', 'COUNT', 'RATIO']),
    requiresEvidence: z.boolean().default(false),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().nullable().optional(),
    reason: reasonSchema,
  })
  .superRefine((value, context) => {
    if (
      value.sourceType === 'FORM_FIELD' &&
      (!value.formTemplateId || !value.formVersionId || !value.jsonPointer)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Form mapping cần template, version và JSON Pointer.',
      });
    }
    if (value.sourceType === 'DOMAIN_ADAPTER' && !value.adapterCode) {
      context.addIssue({
        code: 'custom',
        path: ['adapterCode'],
        message: 'Adapter code là bắt buộc.',
      });
    }
  });

export const policyFieldsSchema = z
  .object({
    effectiveFromDate: businessDateSchema,
    effectiveToDate: businessDateSchema.nullable().optional(),
    timezone: z.string().min(1).max(64),
    reportOpenLocal: localTimeSchema,
    reportCloseLocal: localTimeSchema,
    evaluationLocal: localTimeSchema,
    failurePenaltyMinor: z
      .string()
      .regex(/^[0-9]+$/)
      .default('100000'),
    currency: z.literal('VND'),
    kpiDefinitionIds: z.array(uuidSchema).max(200).default([]),
    membershipScope: z.record(z.string(), z.unknown()).default({}),
    exemptionRule: z.record(z.string(), z.unknown()).default({}),
    evidenceEnabled: z.boolean(),
    evidenceGraceSeconds: z.number().int().min(0).max(86_400).default(300),
    photoPenaltyMinor: z
      .string()
      .regex(/^[0-9]+$/)
      .nullable()
      .optional(),
  })
  .superRefine((value, context) => {
    if (!(
      value.reportOpenLocal < value.reportCloseLocal &&
      value.reportCloseLocal < value.evaluationLocal
    )) {
      context.addIssue({ code: 'custom', message: 'Giờ phải theo thứ tự mở < đóng < đánh giá.' });
    }
    try {
      new Intl.DateTimeFormat('vi-VN', { timeZone: value.timezone });
    } catch {
      context.addIssue({
        code: 'custom',
        path: ['timezone'],
        message: 'Múi giờ IANA không hợp lệ.',
      });
    }
  });

export const bulkPolicySchema = policyFieldsSchema.and(
  z
    .object({
      scope: z.enum(['TENANT', 'BRANCHES']),
      branchIds: z.array(uuidSchema).max(500),
      reason: reasonSchema,
    })
    .superRefine((value, context) => {
      const unique = new Set(value.branchIds);
      if (unique.size !== value.branchIds.length) {
        context.addIssue({
          code: 'custom',
          path: ['branchIds'],
          message: 'Cơ sở không được trùng.',
        });
      }
      if (value.scope === 'TENANT' && value.branchIds.length !== 0) {
        context.addIssue({
          code: 'custom',
          path: ['branchIds'],
          message: 'Tenant policy không có cơ sở.',
        });
      }
      if (value.scope === 'BRANCHES' && value.branchIds.length === 0) {
        context.addIssue({
          code: 'custom',
          path: ['branchIds'],
          message: 'Phải chọn ít nhất một cơ sở.',
        });
      }
    }),
);

export const createReportRevisionSchema = z.object({
  formSubmissionId: uuidSchema,
  reason: reasonSchema.optional(),
});

export const evaluationRerunSchema = z.object({
  branchIds: z.array(uuidSchema).max(500).optional(),
  membershipIds: z.array(uuidSchema).max(10_000).optional(),
  reason: reasonSchema,
});

export const penaltyAdjustmentSchema = z.object({
  deltaMinor: exactIntegerSchema,
  reason: reasonSchema,
});

export type CreateKpiDefinitionInput = z.infer<typeof createKpiDefinitionSchema>;
export type CreateTargetVersionInput = z.infer<typeof createTargetVersionSchema>;
export type CreateSourceMappingInput = z.infer<typeof createSourceMappingSchema>;
export type BulkPolicyInput = z.infer<typeof bulkPolicySchema>;
export type CreateReportRevisionInput = z.infer<typeof createReportRevisionSchema>;
