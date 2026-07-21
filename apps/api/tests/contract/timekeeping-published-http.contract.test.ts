import { describe, expect, it } from 'vitest';
import { loadTimekeepingOpenApiDocument } from '@adsup/contracts';
import { createApp, type AppDependencies } from '../../src/app.js';
import { dependencies, send } from './published-http.contract.test.js';

const uuid = '10000000-0000-4000-8000-000000000001';
const date = '2026-07-21';

function timekeepingDependencies(): AppDependencies {
  return dependencies({
    attendance: {
      scheduleService: {
        async listShifts() {
          return { items: [], pageInfo: { nextCursor: null } };
        },
        async listSchedules() {
          return { items: [], pageInfo: { nextCursor: null } };
        },
        async createOrEditMySchedule() {
          return { id: uuid, membershipId: uuid, branchId: uuid, businessDate: date };
        },
      },
      attendanceService: {
        async createVideoPolicyVersion() {
          return { id: uuid, scopeType: 'TENANT', versionNumber: 1 };
        },
        async acknowledgeVideoPolicy() {
          return { id: uuid, policyVersionId: uuid, acknowledgedAt: new Date() };
        },
        async createCheckIn() {
          return {
            id: uuid,
            membershipId: uuid,
            branchId: uuid,
            businessDate: date,
            state: 'VIDEO_UPLOADED',
            dayClassification: 'WORKED_ON_TIME',
          };
        },
      },
      videoReviewService: {
        async review() {
          return {
            id: uuid,
            attendanceEventId: uuid,
            reviewStatus: 'PASSED',
            reviewedAt: new Date(),
          };
        },
      },
      offCalendarService: {
        async createVersion() {
          return { id: uuid, scopeType: 'TENANT', name: 'Holiday', versionNumber: 1 };
        },
      },
      absenceService: {
        async listMonthlySummaries() {
          return { items: [], pageInfo: { nextCursor: null } };
        },
      },
    } as unknown as AppDependencies['attendance'],
    workflows: {
      workflowService: {
        async createDefinitionVersion() {
          return { id: uuid, requestType: 'LEAVE_SCHEDULE', scopeType: 'TENANT', versionNumber: 1 };
        },
        async submitRequest() {
          return {
            id: uuid,
            requestType: 'LEAVE_SCHEDULE',
            status: 'IN_REVIEW',
            requestedByMembershipId: uuid,
          };
        },
        async decide() {
          return {
            id: uuid,
            requestType: 'LEAVE_SCHEDULE',
            status: 'APPROVED',
            requestedByMembershipId: uuid,
          };
        },
      },
    } as unknown as AppDependencies['workflows'],
    penalties: {
      penaltyService: {
        async createPolicyVersion() {
          return { id: uuid, scopeType: 'TENANT', versionNumber: 1 };
        },
        async listSettlements() {
          return { items: [], pageInfo: { nextCursor: null } };
        },
        async transitionPayment() {
          return {
            id: uuid,
            membershipId: uuid,
            businessDate: date,
            totalAmountMinor: 50000,
            currency: 'VND',
            status: 'SUBMITTED',
          };
        },
      },
    } as unknown as AppDependencies['penalties'],
  });
}

describe('Module 3 published HTTP conformance', () => {
  it('mounts and authenticates every timekeeping operation', async () => {
    const document = await loadTimekeepingOpenApiDocument();
    const operations = flatten(document.paths as Record<string, Record<string, HttpOperation>>);
    const app = createApp(timekeepingDependencies());
    for (const operation of operations) {
      const response = await send(
        app,
        operation.method,
        concretePath(operation.path, operation.operation.operationId),
      ).send({});
      expect(response.status, operation.operation.operationId).toBe(401);
      expect(response.body).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
    }
  });

  it('executes a declared success response for all 15 Module 3 operations', async () => {
    const document = await loadTimekeepingOpenApiDocument();
    const operations = flatten(document.paths as Record<string, Record<string, HttpOperation>>);
    expect(operations).toHaveLength(15);
    const app = createApp(timekeepingDependencies());
    for (const operation of operations) {
      const operationId = operation.operation.operationId!;
      const response = await send(app, operation.method, concretePath(operation.path, operationId))
        .set('Authorization', 'Bearer test-token')
        .set('idempotency-key', `timekeeping-${operationId}`.slice(0, 128))
        .send(successBodies[operationId] ?? {});
      const declared = Object.keys(operation.operation.responses ?? {}).filter((status) =>
        status.startsWith('2'),
      );
      expect(
        declared,
        `${operationId}: ${response.status} ${JSON.stringify(response.body)}`,
      ).toContain(String(response.status));
    }
  });

  it('returns validation, authorization and safe idempotency errors', async () => {
    const app = createApp(timekeepingDependencies());
    const invalid = await send(app, 'post', `/v1/tenants/${uuid}/attendance/schedules`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'timekeeping-invalid')
      .send({ businessDate: 'not-a-date' });
    expect(invalid.status).toBe(422);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');

    const denied = createApp(
      dependencies({
        rbacRepo: {
          async hasPermission() {
            return false;
          },
        } as unknown as AppDependencies['rbacRepo'],
        attendance: timekeepingDependencies().attendance,
      }),
    );
    const forbidden = await send(
      denied,
      'get',
      `/v1/tenants/${uuid}/attendance/schedules?dateFrom=${date}&dateTo=${date}`,
    ).set('Authorization', 'Bearer test-token');
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('AUTHORIZATION_DENIED');
  });
});

function flatten(paths: Record<string, Record<string, HttpOperation>>) {
  return Object.entries(paths).flatMap(([path, item]) =>
    Object.entries(item)
      .filter(([method]) => ['get', 'post', 'patch', 'put', 'delete'].includes(method))
      .map(([method, operation]) => ({ path, method, operation })),
  );
}

function concretePath(path: string, operationId?: string) {
  let result = `/api${path}`
    .replace('/api/v1', '/v1')
    .replaceAll('{tenantId}', uuid)
    .replaceAll('{attendanceEventId}', uuid)
    .replaceAll('{requestId}', uuid)
    .replaceAll('{settlementId}', uuid);
  if (operationId === 'listWorkSchedules') result += `?dateFrom=${date}&dateTo=${date}`;
  if (operationId === 'listMonthlyAbsenceSummaries') result += '?yearMonth=2026-07';
  if (operationId === 'listAttendancePenaltySettlements') result += '?yearMonth=2026-07';
  return result;
}

interface HttpOperation {
  operationId?: string;
  responses?: Record<string, unknown>;
}

const successBodies: Record<string, unknown> = {
  createOrEditMySchedule: {
    businessDate: date,
    shiftDefinitionId: uuid,
    reason: 'Register shift',
  },
  createCompanyOffCalendarVersion: {
    scopeType: 'TENANT',
    name: 'Tet holiday',
    startDate: date,
    endDate: date,
    reason: 'Company holiday',
  },
  createVideoPolicyVersion: {
    scopeType: 'TENANT',
    effectiveFromDate: date,
    requiresAcknowledgement: true,
    requiresFullBody: true,
    requiresWorkArea: true,
    manualReviewRequired: true,
    missingCheckinPenaltyMinor: 50000,
    videoFailedPenaltyMinor: 50000,
    reason: 'Default video policy',
  },
  acknowledgeVideoPolicy: { policyVersionId: uuid, action: 'ACKNOWLEDGED' },
  createVideoCheckIn: { businessDate: date, mediaObjectId: uuid },
  reviewCheckInVideo: { reviewStatus: 'PASSED', reason: 'Manual review passed' },
  createWorkflowDefinitionVersion: {
    requestType: 'LEAVE_SCHEDULE',
    scopeType: 'TENANT',
    steps: [{ mode: 'SEQUENTIAL', approverRule: 'TENANT_OWNER', requiredApprovalCount: 1 }],
    reason: 'Default leave approval',
  },
  submitApprovalRequest: {
    requestType: 'LEAVE_SCHEDULE',
    payload: { durationKind: 'FULL_DAY', startDate: date, endDate: date },
    reason: 'Need leave',
  },
  recordApprovalDecision: { decision: 'APPROVE', reason: 'Approved' },
  createAttendancePenaltyPolicyVersion: {
    scopeType: 'TENANT',
    effectiveFromDate: date,
    currency: 'VND',
    reason: 'Default attendance penalty policy',
  },
  createPenaltyPaymentTransition: {
    toStatus: 'SUBMITTED',
    amountMinor: 50000,
    reason: 'Paid cash',
  },
};
