import { describe, expect, it } from 'vitest';
import { CustomerService } from '../../src/modules/bookings/customer-service.js';
import { BookingRepository } from '@adsup/database';

const tenantId = '10000000-0000-4000-8000-000000000001';
const otherTenantId = '10000000-0000-4000-8000-000000000002';
const branchId = '20000000-0000-4000-8000-000000000001';
const otherBranchId = '20000000-0000-4000-8000-000000000002';
const customerId = '30000000-0000-4000-8000-000000000001';

function createHarness() {
  let customer = {
    tenantId,
    id: customerId,
    displayName: 'Khach A',
    phoneNormalized: '0900000000',
    emailNormalized: null,
    note: null,
    stateVersion: 1,
    archivedAt: null,
    createdByMembershipId: '40000000-0000-4000-8000-000000000001',
    createdAt: new Date(),
    updatedAt: new Date(),
    branchIds: [branchId],
  };
  const repository = {
    listCustomers: async (input: { tenantId: string; allowedBranchIds: string[] | null }) => ({
      items:
        input.tenantId === tenantId &&
        (input.allowedBranchIds === null || input.allowedBranchIds.includes(branchId))
          ? [customer]
          : [],
      nextCursor: null,
    }),
    getCustomer: async (input: { tenantId: string; allowedBranchIds: string[] | null }) =>
      input.tenantId === tenantId &&
      (input.allowedBranchIds === null || input.allowedBranchIds.includes(branchId))
        ? customer
        : null,
    updateCustomer: async (input: {
      tenantId: string;
      expectedStateVersion: number;
      displayName?: string;
    }) => {
      if (input.tenantId !== tenantId || input.expectedStateVersion !== customer.stateVersion) {
        return null;
      }
      customer = {
        ...customer,
        displayName: input.displayName ?? customer.displayName,
        stateVersion: customer.stateVersion + 1,
      };
      return customer;
    },
  };
  const authorization = {
    resolvePermissionScope: async () => ({ tenantWide: false, branchIds: [branchId] }),
  };
  return {
    service: new CustomerService(repository as never, authorization as never),
  };
}

describe('booking customer isolation', () => {
  it('lists only customers visible in the actor branch scope', async () => {
    const { service } = createHarness();
    const visible = await service.list({
      tenantId,
      actorMembershipId: '40000000-0000-4000-8000-000000000001',
      branchId,
      limit: 20,
    });
    const hidden = await service.list({
      tenantId,
      actorMembershipId: '40000000-0000-4000-8000-000000000001',
      branchId: otherBranchId,
      limit: 20,
    });
    expect(visible.items).toHaveLength(1);
    expect(hidden.items).toHaveLength(0);
  });

  it('does not disclose a customer from another tenant', async () => {
    const { service } = createHarness();
    await expect(
      service.get({
        tenantId: otherTenantId,
        actorMembershipId: '40000000-0000-4000-8000-000000000001',
        customerId,
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it('allows only one update for the same expected state version', async () => {
    const { service } = createHarness();
    const input = {
      tenantId,
      actorMembershipId: '40000000-0000-4000-8000-000000000001',
      customerId,
      expectedStateVersion: 1,
      reason: 'Correct customer name',
      correlationId: 'customer-race',
    };
    const results = await Promise.allSettled([
      service.update({ ...input, displayName: 'Khach A1' }),
      service.update({ ...input, displayName: 'Khach A2' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('applies tenant and branch filters in the concrete customer repository', async () => {
    const filters: unknown[] = [];
    const database = {
      customerBranchAccess: {
        findMany: async (input: { where: unknown }) => {
          filters.push(input.where);
          return filters.length === 1 ? [{ customerId, branchId }] : [{ customerId, branchId }];
        },
      },
      customer: {
        findMany: async (input: { where: unknown }) => {
          filters.push(input.where);
          return [
            {
              tenantId,
              id: customerId,
              displayName: 'Khach A',
              archivedAt: null,
            },
          ];
        },
      },
    };
    const page = await new BookingRepository(database as never).listCustomers({
      tenantId,
      allowedBranchIds: [branchId],
      branchId,
      limit: 20,
    });
    expect(page.items).toHaveLength(1);
    expect(filters).toContainEqual(
      expect.objectContaining({ tenantId, branchId: { in: [branchId] }, revokedAt: null }),
    );
    expect(filters).toContainEqual(expect.objectContaining({ tenantId, archivedAt: null }));
  });
});
