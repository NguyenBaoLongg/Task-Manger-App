import { describe, expect, it } from 'vitest';
import { loadTimekeepingOpenApiDocument } from './index.js';

const mutationMethods = new Set(['post', 'patch', 'put', 'delete']);

describe('Module 3 OpenAPI', () => {
  it('publishes the scoped schedule, attendance, workflow, leave and penalty operations', async () => {
    const document = await loadTimekeepingOpenApiDocument();
    const paths = document.paths as Record<string, Record<string, { operationId?: string }>>;
    const operations = Object.values(paths).flatMap((path) =>
      Object.entries(path)
        .filter(([method]) => ['get', 'post', 'patch', 'put', 'delete'].includes(method))
        .map(([, operation]) => operation.operationId),
    );
    expect(Object.keys(paths)).toHaveLength(14);
    expect(operations).toHaveLength(15);
    expect(new Set(operations).size).toBe(15);
    expect(operations).toEqual(
      expect.arrayContaining([
        'listShiftDefinitions',
        'createOrEditMySchedule',
        'createVideoPolicyVersion',
        'acknowledgeVideoPolicy',
        'createVideoCheckIn',
        'reviewCheckInVideo',
        'createWorkflowDefinitionVersion',
        'submitApprovalRequest',
        'recordApprovalDecision',
        'listMonthlyAbsenceSummaries',
        'createAttendancePenaltyPolicyVersion',
        'listAttendancePenaltySettlements',
        'createPenaltyPaymentTransition',
      ]),
    );
    expect(document.security).toEqual([{ bearerAuth: [] }]);
  });

  it('requires idempotency on every public mutation and cursor pagination on list operations', async () => {
    const document = await loadTimekeepingOpenApiDocument();
    const paths = document.paths as Record<
      string,
      Record<string, { operationId?: string; parameters?: Array<{ $ref?: string; name?: string }> }>
    >;
    for (const [path, item] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(item)) {
        if (mutationMethods.has(method)) {
          expect(
            operation.parameters?.some((parameter) => parameter.$ref?.endsWith('/IdempotencyKey')),
            `${method.toUpperCase()} ${path}`,
          ).toBe(true);
        }
        if (method === 'get') {
          expect(
            operation.parameters?.some(
              (parameter) => parameter.$ref?.endsWith('/Cursor') || parameter.name === 'cursor',
            ),
            `GET ${path}`,
          ).toBe(true);
        }
      }
    }
  });

  it('models video review as manual, leave through workflows, exact penalties and privacy-safe pages', async () => {
    const document = await loadTimekeepingOpenApiDocument();
    const paths = document.paths as Record<string, unknown>;
    const schemas = (document.components as { schemas: Record<string, unknown> }).schemas;
    expect(paths).toHaveProperty('/v1/tenants/{tenantId}/workflows/requests');
    expect(paths).not.toHaveProperty('/v1/tenants/{tenantId}/attendance/leave-requests');
    expect(JSON.stringify(schemas.VideoReviewRequest)).toContain('PASSED');
    expect(JSON.stringify(schemas.VideoReviewRequest)).toContain('FAILED');
    expect(JSON.stringify(schemas.VideoReviewRequest)).not.toContain('AUTO_FAILED');
    expect(JSON.stringify(schemas.AttendancePenaltyPolicyVersion)).toContain('lateFixed1To15Minor');
    expect(JSON.stringify(schemas.PenaltySettlementPage)).toContain('pageInfo');
    expect(JSON.stringify(schemas)).not.toContain('signedUrl');
    expect(JSON.stringify(schemas)).not.toContain('paymentGateway');
  });
});
