import { describe, expect, it } from 'vitest';
import { createApp, type AppDependencies } from '../../src/app.js';
import { dependencies, send } from './published-http.contract.test.js';

const uuid = '10000000-0000-4000-8000-000000000001';

function workflowDependencies(overrides: Partial<AppDependencies> = {}) {
  return dependencies({
    workflows: {
      workflowService: {
        async createDefinitionVersion() {
          return { id: uuid, requestType: 'SHIFT_CHANGE', scopeType: 'TENANT', versionNumber: 1 };
        },
        async submitRequest() {
          return {
            id: uuid,
            requestType: 'SHIFT_CHANGE',
            status: 'IN_REVIEW',
            requestedByMembershipId: uuid,
          };
        },
        async decide() {
          return {
            id: uuid,
            requestType: 'SHIFT_CHANGE',
            status: 'APPROVED',
            requestedByMembershipId: uuid,
          };
        },
      },
    } as unknown as AppDependencies['workflows'],
    ...overrides,
  });
}

describe('workflow contract', () => {
  it('configures definitions, submits requests through /workflows/requests and records decisions', async () => {
    const app = createApp(workflowDependencies());
    const definition = await send(app, 'post', `/v1/tenants/${uuid}/workflows/definitions`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'workflow-definition')
      .send({
        requestType: 'SHIFT_CHANGE',
        scopeType: 'TENANT',
        steps: [{ mode: 'SEQUENTIAL', approverRule: 'TENANT_OWNER', requiredApprovalCount: 1 }],
        reason: 'Default workflow',
      });
    expect(definition.status).toBe(201);

    const request = await send(app, 'post', `/v1/tenants/${uuid}/workflows/requests`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'workflow-request')
      .send({
        requestType: 'SHIFT_CHANGE',
        payload: { businessDate: '2026-07-21' },
        reason: 'Change shift',
      });
    expect(request.status).toBe(201);
    expect(request.body.status).toBe('IN_REVIEW');

    const decision = await send(
      app,
      'post',
      `/v1/tenants/${uuid}/workflows/requests/${uuid}/decisions`,
    )
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'workflow-decision')
      .send({ decision: 'APPROVE', reason: 'Approved' });
    expect(decision.status).toBe(200);
    expect(decision.body.status).toBe('APPROVED');
  });

  it('rejects unsupported leave route outside /workflows/requests', async () => {
    const app = createApp(workflowDependencies());
    const response = await send(app, 'post', `/v1/tenants/${uuid}/attendance/leave-requests`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'wrong-leave-route')
      .send({});
    expect(response.status).toBe(404);
  });
});
