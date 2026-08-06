import { createApiClient } from '@/api/api-client';
import { selectWorkspace, selectBranch } from '@/features/workspace/workspace-queries';
import { createTenantContext } from '@/tenant/tenant-context';

describe('auth and workspace integration boundaries', () => {
  it('loads memberships and branches only through the authenticated tenant scope', async () => {
    const fetchImpl = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchImpl
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ tenantId: 'tenant-a', name: 'A', membershipId: 'm-a' }]), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'branch-a', name: 'Clinic A' }]), { status: 200 }),
      );
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'access',
      fetchImpl,
    });
    const workspace = await selectWorkspace(client);
    const branch = await selectBranch(client, workspace[0]!.tenantId);
    expect(workspace[0]!.tenantId).toBe('tenant-a');
    expect(branch[0]!.id).toBe('branch-a');
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/v1/me/tenants',
      'https://api.example.test/v1/tenants/tenant-a/branches',
    ]);
  });

  it('denies a foreign tenant or branch before a screen can use the resource', () => {
    const context = createTenantContext({
      tenantId: 'tenant-a',
      membershipId: 'm-a',
      branchId: 'branch-a',
      permissions: [],
      version: 1,
    });
    expect(() => context.assertScope({ tenantId: 'tenant-b', branchId: 'branch-a' })).toThrow(
      'TENANT_SCOPE_MISMATCH',
    );
    expect(() => context.assertScope({ tenantId: 'tenant-a', branchId: 'branch-b' })).toThrow(
      'BRANCH_SCOPE_MISMATCH',
    );
  });

  it('normalizes the backend tenant and membership summary for workspace selection', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            tenant: { id: 'tenant-b', name: 'Backend Clinic', status: 'ACTIVE' },
            membership: { id: 'm-b', tenantId: 'tenant-b', status: 'ACTIVE' },
          },
        ]),
      ),
    ) as jest.MockedFunction<typeof fetch>;
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'access',
      fetchImpl,
    });

    await expect(selectWorkspace(client)).resolves.toEqual([
      { tenantId: 'tenant-b', membershipId: 'm-b', name: 'Backend Clinic', status: 'ACTIVE' },
    ]);
  });
});
