import { createApiClient } from '@/api/api-client';
import {
  buildInvitationExpiresAt,
  buildSharePayload,
  createInvitation,
  INVITATION_VALIDITY_MS,
  listInviteRoles,
  parseInvitationResult,
} from '@/features/members/invite-model';

const backendInvitation = {
  id: 'inv-1',
  type: 'DIRECT',
  state: 'ACTIVE',
  tokenHint: 'ABC123',
  maxUses: 1,
  useCount: 0,
  expiresAt: '2026-10-06T12:00:00.000Z',
  token: 'full-token-value',
  inviteUrl: 'https://adsup.example/invite/ABC123',
};

const makeClient = (fetchImpl: jest.MockedFunction<typeof fetch>) =>
  createApiClient({
    baseUrl: 'https://api.example.test',
    getAccessToken: () => 'access',
    fetchImpl,
  });

describe('invite model', () => {
  it('sets the invitation expiry to exactly seven days from now', () => {
    const nowMs = new Date('2026-09-29T12:00:00.000Z').getTime();
    expect(INVITATION_VALIDITY_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(buildInvitationExpiresAt(nowMs).toISOString()).toBe('2026-10-06T12:00:00.000Z');
  });

  it('parses token, tokenHint and expiresAt from the create response', () => {
    const result = parseInvitationResult(backendInvitation);
    expect(result).toEqual({
      id: 'inv-1',
      token: 'full-token-value',
      tokenHint: 'ABC123',
      expiresAt: '2026-10-06T12:00:00.000Z',
      inviteUrl: 'https://adsup.example/invite/ABC123',
    });
  });

  it('sends DIRECT invitations with a fresh idempotency key on every create', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(backendInvitation), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...backendInvitation, id: 'inv-2' }), { status: 201 }),
      ) as jest.MockedFunction<typeof fetch>;
    const client = makeClient(fetchImpl);

    const first = await createInvitation(client, 'tenant-a', 'role-1', {
      nowMs: new Date('2026-09-29T12:00:00.000Z').getTime(),
    });
    await createInvitation(client, 'tenant-a', 'role-1', {
      nowMs: new Date('2026-09-29T12:00:00.000Z').getTime(),
    });

    expect(first.token).toBe('full-token-value');
    const [firstCall, secondCall] = fetchImpl.mock.calls;
    expect(firstCall![0]).toBe('https://api.example.test/v1/tenants/tenant-a/invitations');
    const firstBody = JSON.parse(firstCall![1]!.body as string) as Record<string, unknown>;
    expect(firstBody).toEqual({
      type: 'DIRECT',
      roleId: 'role-1',
      expiresAt: '2026-10-06T12:00:00.000Z',
    });
    const firstKey = (firstCall![1]!.headers as Record<string, string>)['Idempotency-Key'];
    const secondKey = (secondCall![1]!.headers as Record<string, string>)['Idempotency-Key'];
    expect(firstKey).toBeDefined();
    expect(firstKey!.length).toBeGreaterThanOrEqual(8);
    expect(secondKey).toBeDefined();
    expect(secondKey).not.toBe(firstKey);
  });

  it('reuses the provided idempotency key so a retry cannot double-create', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(backendInvitation), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...backendInvitation, id: 'inv-3' }), { status: 201 }),
      ) as jest.MockedFunction<typeof fetch>;
    const client = makeClient(fetchImpl);

    await createInvitation(client, 'tenant-a', 'role-1', { idempotencyKey: 'fixed-key-123' });
    await createInvitation(client, 'tenant-a', 'role-1', { idempotencyKey: 'fixed-key-123' });

    const keys = fetchImpl.mock.calls.map(
      ([, init]) => (init!.headers as Record<string, string>)['Idempotency-Key'],
    );
    expect(keys).toEqual(['fixed-key-123', 'fixed-key-123']);
  });

  it('lists roles through the tenant scope', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 'role-1', name: 'Nhân viên', code: 'EMPLOYEE' }]), {
        status: 200,
      }),
    ) as jest.MockedFunction<typeof fetch>;
    const roles = await listInviteRoles(makeClient(fetchImpl), 'tenant-a');
    expect(roles).toEqual([{ id: 'role-1', name: 'Nhân viên', code: 'EMPLOYEE' }]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.test/v1/tenants/tenant-a/roles',
      expect.anything(),
    );
  });

  it('builds a share payload containing the code and short guidance', () => {
    const payload = buildSharePayload({
      id: 'inv-1',
      token: 'full-token-value',
      tokenHint: 'ABC123',
      expiresAt: '2026-10-06T12:00:00.000Z',
    });
    expect(payload).toContain('full-token-value');
    expect(payload).toContain('Mã lời mời');
    expect(payload).toContain('ADSUP');
    expect(payload).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });
});
