import { createApiClient } from '@/api/api-client';
import { acceptInvitation, completePendingJoin } from '@/features/members/join-model';
import { confirmProfile } from '@/features/auth/profile-confirmation';
import { selectWorkspace } from '@/features/workspace/workspace-queries';

const makeClient = (fetchImpl: jest.MockedFunction<typeof fetch>) =>
  createApiClient({
    baseUrl: 'https://api.example.test',
    getAccessToken: () => 'access',
    fetchImpl,
  });

const acceptResponse = {
  id: 'membership-new',
  tenantId: 'tenant-new',
};

describe('member join integration boundaries', () => {
  it('keeps the code across profile confirmation and surfaces the new workspace right after (FR-014, FR-009)', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'PROFILE_CONFIRMATION_REQUIRED',
            message: 'Hãy xác nhận họ tên trước khi tham gia doanh nghiệp.',
          }),
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'user-1',
            email: 'nhan.vien@example.test',
            fullName: 'Nhân Viên Mới',
            fullNameConfirmedAt: '2026-09-29T12:00:00.000Z',
            status: 'ACTIVE',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(acceptResponse), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              tenant: { id: 'tenant-new', name: 'Công ty Mới' },
              membership: { id: 'membership-new', tenantId: 'tenant-new', status: 'ACTIVE' },
            },
          ]),
          { status: 200 },
        ),
      ) as jest.MockedFunction<typeof fetch>;
    const client = makeClient(fetchImpl);
    const token = 'abc-def-123456789012';
    const joinKey = 'mobile-join-flow-key';

    const pending = await acceptInvitation(client, `  ${token}  `, { idempotencyKey: joinKey });
    expect(pending).toEqual({ kind: 'profile-confirmation-required' });

    await confirmProfile(client, 'Nhân Viên Mới', 'profile-confirm-fixed-key');
    const joined = await completePendingJoin(client, token, joinKey);
    expect(joined).toEqual({
      kind: 'joined',
      tenantId: 'tenant-new',
      membershipId: 'membership-new',
    });

    const workspaces = await selectWorkspace(client);
    expect(workspaces).toEqual([
      { tenantId: 'tenant-new', membershipId: 'membership-new', name: 'Công ty Mới', status: 'ACTIVE' },
    ]);

    const [acceptFirst, profilePatch, acceptSecond, workspaceList] = fetchImpl.mock.calls;
    expect(acceptFirst![0]).toBe('https://api.example.test/v1/invitations/accept');
    expect(JSON.parse(acceptFirst![1]!.body as string)).toEqual({ token });
    expect(profilePatch![0]).toBe('https://api.example.test/v1/me');
    expect(profilePatch![1]!.method).toBe('PATCH');
    expect(JSON.parse(profilePatch![1]!.body as string)).toEqual({ fullName: 'Nhân Viên Mới' });
    expect(acceptSecond![0]).toBe('https://api.example.test/v1/invitations/accept');
    expect(workspaceList![0]).toBe('https://api.example.test/v1/me/tenants');
    const acceptKeys = [acceptFirst!, acceptSecond!].map(
      ([, init]) => (init!.headers as Record<string, string>)['Idempotency-Key'],
    );
    expect(acceptKeys).toEqual([joinKey, joinKey]);
  });
});
