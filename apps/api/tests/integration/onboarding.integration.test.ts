import { describe, expect, it } from 'vitest';
import type { AuthTenantsRepository } from '@adsup/database';
import { TenantService } from '../../src/modules/tenants/tenant-service.js';

describe('tenant onboarding transaction inputs', () => {
  it('requires confirmed profile and sends stable idempotency hash', async () => {
    const calls: unknown[] = [];
    const repository = {
      async getUser() {
        return { fullNameConfirmedAt: new Date(), fullName: 'Chủ doanh nghiệp' };
      },
      async bootstrapTenant(input: {
        tenantId: string;
        ownerMembershipId: string;
        userId: string;
      }) {
        calls.push(input);
        return {
          tenant: {
            id: input.tenantId,
            name: 'Clinic Demo',
            slug: 'clinic-demo',
            timezone: 'Asia/Ho_Chi_Minh',
            status: 'ACTIVE',
            settings: {},
            createdByUserId: input.userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          membership: {
            id: input.ownerMembershipId,
            tenantId: input.tenantId,
            userId: input.userId,
            membershipDisplayName: 'Chủ doanh nghiệp',
            employeeCode: null,
            status: 'ACTIVE',
            version: 1,
          },
        };
      },
    } as unknown as AuthTenantsRepository;
    const service = new TenantService(repository);
    await service.create({
      userId: 'user-1',
      name: 'Clinic Demo',
      correlationId: 'c1',
      idempotencyKey: 'tenant-demo-0001',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      idempotencyKey: 'tenant-demo-0001',
      timezone: 'Asia/Ho_Chi_Minh',
    });
  });
});
