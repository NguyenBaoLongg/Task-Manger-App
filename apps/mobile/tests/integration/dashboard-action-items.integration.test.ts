import { createApiClient } from '@/api/api-client';
import {
  listEmployeeActionItems,
  listManagedActionItems,
} from '@/features/action-items/action-item-feed';

describe('dashboard and action-item integration', () => {
  it('keeps employee filters and cursor pagination tenant-scoped', async () => {
    const fetchImpl = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ items: [], nextCursor: null, openCount: 0 }), { status: 200 }),
    );
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'access',
      fetchImpl,
    });
    await listEmployeeActionItems(client, 'tenant-a', {
      state: 'OPEN',
      itemType: 'KPI',
      businessDate: '2026-07-26',
      cursor: 'cursor-1',
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://api.example.test/v1/tenants/tenant-a/action-items?state=OPEN&itemType=KPI&businessDate=2026-07-26&cursor=cursor-1',
    );
  });

  it('keeps manager branch/department/member filters separate from employee filters', async () => {
    const fetchImpl = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ items: [], nextCursor: null, openCount: 0 }), { status: 200 }),
    );
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'access',
      fetchImpl,
    });
    await listManagedActionItems(client, 'tenant-a', {
      branchId: 'branch-a',
      departmentId: 'dep-a',
      membershipId: 'm-a',
      itemType: 'ATTENDANCE',
      state: 'OPEN',
      from: '2026-07-01',
      to: '2026-07-26',
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://api.example.test/v1/tenants/tenant-a/management/action-items?branchId=branch-a&departmentId=dep-a&membershipId=m-a&itemType=ATTENDANCE&state=OPEN&from=2026-07-01&to=2026-07-26',
    );
  });
});
