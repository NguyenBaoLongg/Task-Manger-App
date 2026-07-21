import { describe, expect, it } from 'vitest';
import { loadKpiOpenApiDocument } from '@adsup/contracts';
import { createApp, type AppDependencies } from '../../src/app.js';
import { dependencies, send } from './published-http.contract.test.js';

const uuid = '10000000-0000-4000-8000-000000000001';
const date = '2026-07-19';

function kpiDependencies(): AppDependencies {
  return dependencies({
    kpiConfigService: {
      async list() {
        return [];
      },
      async createDefinition() {
        return { id: uuid, code: 'REVENUE' };
      },
      async createTarget() {
        return { id: uuid, versionNumber: 1 };
      },
      async createSourceMapping() {
        return { id: uuid, versionNumber: 1 };
      },
    } as unknown as AppDependencies['kpiConfigService'],
    kpiPolicyService: {
      async bulkCreate() {
        return [{ id: uuid, versionNumber: 1 }];
      },
      async effective() {
        return { id: uuid, branchId: uuid, versionNumber: 1 };
      },
    } as unknown as AppDependencies['kpiPolicyService'],
    kpiReportService: {
      async revisions() {
        return { items: [], nextCursor: null };
      },
      async appendRevision() {
        return { id: uuid, reportId: uuid, revisionNumber: 1 };
      },
    } as unknown as AppDependencies['kpiReportService'],
    kpiProgressService: {
      async current() {
        return {
          businessDate: date,
          reportStatus: 'OPEN',
          openedAt: new Date(),
          closedAt: new Date(),
          items: [],
          evidenceDebt: null,
        };
      },
    } as unknown as AppDependencies['kpiProgressService'],
    actionItemService: {
      async listMine() {
        return { items: [], openCount: 0, nextCursor: null };
      },
      async listManaged() {
        return {
          items: [],
          openCount: 0,
          nextCursor: null,
          summary: { missingReports: 0, failedKpis: 0, photoDebts: 0, overdue: 0 },
        };
      },
    } as unknown as AppDependencies['actionItemService'],
    actionItemManagementService: {
      async list() {
        return {
          items: [],
          openCount: 0,
          nextCursor: null,
          summary: { missingReports: 0, failedKpis: 0, photoDebts: 0, overdue: 0 },
        };
      },
    } as unknown as AppDependencies['actionItemManagementService'],
    kpiEvaluationService: {
      async list() {
        return { items: [], nextCursor: null };
      },
      async enqueueRerun() {
        return { id: uuid, status: 'PENDING' };
      },
    } as unknown as AppDependencies['kpiEvaluationService'],
    kpiPenaltyService: {
      async adjust() {
        return {
          adjustment: {
            id: uuid,
            penaltyOutcomeId: uuid,
            deltaMinor: -50000n,
            reason: 'Correction',
            createdAt: new Date(),
          },
          effectiveAmountMinor: 50000n,
        };
      },
    } as unknown as AppDependencies['kpiPenaltyService'],
    kpiEvidenceService: {
      async refresh() {
        return {
          id: uuid,
          requiredCount: 2,
          receivedCount: 1,
          state: 'WAITING_PHOTOS',
          deadlineAt: new Date(),
        };
      },
    } as unknown as AppDependencies['kpiEvidenceService'],
  });
}

describe('Module 2 published HTTP conformance', () => {
  it('mounts and authenticates every KPI operation', async () => {
    const document = await loadKpiOpenApiDocument();
    const paths = document.paths as Record<string, Record<string, HttpOperation>>;
    const operations = flatten(paths);
    const app = createApp(kpiDependencies());
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

  it('executes a declared success for all 15 KPI operations', async () => {
    const document = await loadKpiOpenApiDocument();
    const paths = document.paths as Record<string, Record<string, HttpOperation>>;
    const operations = flatten(paths);
    expect(operations).toHaveLength(15);
    const app = createApp(kpiDependencies());
    for (const operation of operations) {
      const operationId = operation.operation.operationId!;
      const response = await send(app, operation.method, concretePath(operation.path, operationId))
        .set('Authorization', 'Bearer test-token')
        .set('idempotency-key', `kpi-${operationId}`)
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
    const app = createApp(kpiDependencies());
    const invalid = await send(app, 'post', `/v1/tenants/${uuid}/kpi/definitions`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'kpi-invalid')
      .send({ code: 'bad' });
    expect(invalid.status).toBe(422);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');

    const denied = createApp(
      dependencies({
        rbacRepo: {
          async hasPermission() {
            return false;
          },
        } as unknown as AppDependencies['rbacRepo'],
        kpiConfigService: kpiDependencies().kpiConfigService,
      }),
    );
    const forbidden = await send(denied, 'get', `/v1/tenants/${uuid}/kpi/definitions`).set(
      'Authorization',
      'Bearer test-token',
    );
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
    .replaceAll('{businessDate}', date)
    .replaceAll('{penaltyId}', uuid)
    .replaceAll('{debtId}', uuid);
  if (operationId === 'getEffectiveDailyKpiPolicy')
    result += `?branchId=${uuid}&businessDate=${date}`;
  return result;
}

interface HttpOperation {
  operationId?: string;
  responses?: Record<string, unknown>;
}

const successBodies: Record<string, unknown> = {
  createKpiDefinition: {
    code: 'REVENUE',
    name: 'Revenue',
    valueType: 'MONEY',
    unit: 'VND',
    direction: 'AT_LEAST',
    sourceType: 'FORM_FIELD',
    reason: 'Create KPI definition',
  },
  createKpiTargetVersion: {
    kpiDefinitionId: uuid,
    scopeType: 'TENANT',
    target: { value: '100000', unit: 'VND' },
    required: true,
    effectiveFrom: '2026-01-01T00:00:00Z',
    reason: 'Create KPI target',
  },
  createKpiSourceMappingVersion: {
    kpiDefinitionId: uuid,
    sourceType: 'DOMAIN_ADAPTER',
    adapterCode: 'TEST',
    aggregation: 'LATEST',
    requiresEvidence: false,
    effectiveFrom: '2026-01-01T00:00:00Z',
    reason: 'Create source mapping',
  },
  bulkCreateDailyKpiPolicyVersions: {
    scope: 'TENANT',
    branchIds: [],
    effectiveFromDate: '2026-01-01',
    timezone: 'Asia/Ho_Chi_Minh',
    reportOpenLocal: '18:00:00',
    reportCloseLocal: '20:00:00',
    evaluationLocal: '20:00:01',
    failurePenaltyMinor: '100000',
    currency: 'VND',
    evidenceEnabled: false,
    reason: 'Create KPI policy',
  },
  createDailyKpiReportRevision: { formSubmissionId: uuid },
  enqueueDailyKpiEvaluationRerun: { reason: 'Retry daily evaluation' },
  createKpiPenaltyAdjustment: { deltaMinor: '-50000', reason: 'Approved correction' },
};
