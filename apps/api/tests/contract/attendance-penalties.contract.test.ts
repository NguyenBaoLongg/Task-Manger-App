import { describe, expect, it } from 'vitest';
import { createApp, type AppDependencies } from '../../src/app.js';
import { dependencies, send } from './published-http.contract.test.js';

const uuid = '10000000-0000-4000-8000-000000000001';
const date = '2026-07-21';

function penaltyDependencies(overrides: Partial<AppDependencies> = {}) {
  return dependencies({
    penalties: {
      penaltyService: {
        async createPolicyVersion() {
          return { id: uuid, scopeType: 'TENANT', versionNumber: 1, currency: 'VND' };
        },
        async listSettlements() {
          return {
            items: [
              {
                id: uuid,
                membershipId: uuid,
                businessDate: date,
                totalAmountMinor: 150000,
                currency: 'VND',
                status: 'PENDING',
              },
            ],
            pageInfo: { nextCursor: null },
          };
        },
        async getSettlement() {
          return { membershipId: uuid, branchId: uuid };
        },
        async transitionPayment() {
          return {
            id: uuid,
            membershipId: uuid,
            businessDate: date,
            totalAmountMinor: 150000,
            currency: 'VND',
            status: 'CONFIRMED',
          };
        },
      },
    } as unknown as AppDependencies['penalties'],
    ...overrides,
  });
}

describe('attendance penalties contract', () => {
  it('configures penalty policy, lists settlements and records payment transitions', async () => {
    const app = createApp(penaltyDependencies());
    const policy = await send(app, 'post', `/v1/tenants/${uuid}/attendance/penalty-policies`)
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'penalty-policy-create')
      .send({
        scopeType: 'TENANT',
        effectiveFromDate: date,
        currency: 'VND',
        reason: 'Default attendance policy',
      });
    expect(policy.status).toBe(201);

    const settlements = await send(
      app,
      'get',
      `/v1/tenants/${uuid}/attendance/penalty-settlements?yearMonth=2026-07`,
    ).set('Authorization', 'Bearer test-token');
    expect(settlements.status).toBe(200);
    expect(settlements.body.items[0]).toMatchObject({ status: 'PENDING' });

    const transition = await send(
      app,
      'post',
      `/v1/tenants/${uuid}/attendance/penalty-settlements/${uuid}/payment-transitions`,
    )
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'penalty-payment-confirm')
      .send({ toStatus: 'CONFIRMED', amountMinor: 150000, reason: 'Cash received' });
    expect(transition.status).toBe(200);
    expect(transition.body.status).toBe('CONFIRMED');
  });

  it('rejects payment proof fields outside the published contract', async () => {
    const app = createApp(penaltyDependencies());
    const response = await send(
      app,
      'post',
      `/v1/tenants/${uuid}/attendance/penalty-settlements/${uuid}/payment-transitions`,
    )
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'penalty-payment-extra')
      .send({ toStatus: 'SUBMITTED', amountMinor: 150000, reason: 'Paid', paymentGateway: 'x' });
    expect(response.status).toBe(422);
    expect(response.body.code).toBe('VALIDATION_FAILED');
  });

  it('allows employee self-listing and own payment-proof submission without manager permission', async () => {
    const listInputs: Record<string, unknown>[] = [];
    const transitionInputs: Record<string, unknown>[] = [];
    const app = createApp(
      penaltyDependencies({
        penalties: {
          penaltyService: {
            async createPolicyVersion() {
              return {};
            },
            async listSettlements(input: Record<string, unknown>) {
              listInputs.push(input);
              return { items: [], pageInfo: { nextCursor: null } };
            },
            async getSettlement() {
              return { membershipId: uuid, branchId: uuid };
            },
            async transitionPayment(input: Record<string, unknown>) {
              transitionInputs.push(input);
              return { id: uuid, status: 'SUBMITTED' };
            },
          },
        } as unknown as AppDependencies['penalties'],
        rbacRepo: {
          async hasPermission(_tenantId: string, _membershipId: string, permission: string) {
            return permission === 'attendance.penalty.self';
          },
          async hasAnyPermission() {
            return false;
          },
        } as never,
      }),
    );

    const listed = await send(
      app,
      'get',
      `/v1/tenants/${uuid}/attendance/penalty-settlements?yearMonth=2026-07`,
    ).set('Authorization', 'Bearer test-token');
    expect(listed.status).toBe(200);
    expect(listInputs[0]).toMatchObject({
      actorMembershipId: uuid,
      canManage: false,
    });

    const submitted = await send(
      app,
      'post',
      `/v1/tenants/${uuid}/attendance/penalty-settlements/${uuid}/payment-transitions`,
    )
      .set('Authorization', 'Bearer test-token')
      .set('idempotency-key', 'employee-proof')
      .send({
        toStatus: 'SUBMITTED',
        amountMinor: 50000,
        mediaObjectId: uuid,
        reason: 'Da nop tien',
      });
    expect(submitted.status).toBe(200);
    expect(transitionInputs[0]).toMatchObject({
      actorMembershipId: uuid,
      canManage: false,
      mediaObjectId: uuid,
    });
  });
});
