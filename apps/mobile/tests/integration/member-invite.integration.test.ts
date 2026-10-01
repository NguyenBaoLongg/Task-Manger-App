import { createApiClient } from '@/api/api-client';
import { createInvitation, listInviteRoles } from '@/features/members/invite-model';

const makeClient = (fetchImpl: jest.MockedFunction<typeof fetch>) =>
  createApiClient({
    baseUrl: 'https://api.example.test',
    getAccessToken: () => 'access',
    fetchImpl,
  });

describe('member invite integration boundaries', () => {
  it('picks a role, creates an invitation and surfaces the one-time code', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: 'role-1', name: 'Nhân viên', code: 'EMPLOYEE', kind: 'CUSTOM' },
            { id: 'role-2', name: 'Quản lý', code: 'MANAGER', kind: 'CUSTOM' },
          ]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'inv-1',
            type: 'DIRECT',
            state: 'ACTIVE',
            tokenHint: 'K7X2',
            maxUses: 1,
            useCount: 0,
            expiresAt: '2026-10-06T12:00:00.000Z',
            token: 'plain-token-once',
            inviteUrl: 'https://adsup.example/invite/K7X2',
          }),
          { status: 201 },
        ),
      ) as jest.MockedFunction<typeof fetch>;
    const client = makeClient(fetchImpl);

    const roles = await listInviteRoles(client, 'tenant-a');
    const selected = roles.find((role) => role.code === 'EMPLOYEE');
    expect(selected).toBeDefined();
    const invitation = await createInvitation(client, 'tenant-a', selected!.id, {
      idempotencyKey: 'mobile-invite-e2e-fixed-key',
    });

    expect(invitation.token).toBe('plain-token-once');
    expect(invitation.tokenHint).toBe('K7X2');
    expect(new Date(invitation.expiresAt).getTime()).toBeGreaterThan(Date.now());
    const createCall = fetchImpl.mock.calls[1]!;
    expect(createCall[0]).toBe('https://api.example.test/v1/tenants/tenant-a/invitations');
    expect(createCall[1]!.method).toBe('POST');
  });

  it('retries a network failure with the same idempotency key so no duplicate is created', async () => {
    const fetchImpl = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'inv-2',
            type: 'DIRECT',
            state: 'ACTIVE',
            tokenHint: 'K7X2',
            maxUses: 1,
            useCount: 0,
            expiresAt: '2026-10-06T12:00:00.000Z',
            token: 'plain-token-once',
            inviteUrl: 'https://adsup.example/invite/K7X2',
          }),
          { status: 201 },
        ),
      ) as jest.MockedFunction<typeof fetch>;
    const client = makeClient(fetchImpl);
    const idempotencyKey = 'mobile-invite-retry-key';

    await expect(
      createInvitation(client, 'tenant-a', 'role-1', { idempotencyKey }),
    ).rejects.toThrow('Network request failed');
    const invitation = await createInvitation(client, 'tenant-a', 'role-1', {
      idempotencyKey,
    });

    expect(invitation.id).toBe('inv-2');
    const keys = fetchImpl.mock.calls.map(
      ([, init]) => (init!.headers as Record<string, string>)['Idempotency-Key'],
    );
    expect(keys).toEqual([idempotencyKey, idempotencyKey]);
  });
});
