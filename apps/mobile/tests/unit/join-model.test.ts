import { createApiClient } from '@/api/api-client';
import {
  acceptInvitation,
  completePendingJoin,
  freshJoinIdempotencyKey,
  JoinError,
} from '@/features/members/join-model';

const backendAccept = {
  id: 'membership-new',
  tenantId: 'tenant-new',
};

const makeClient = (fetchImpl: jest.MockedFunction<typeof fetch>) =>
  createApiClient({
    baseUrl: 'https://api.example.test',
    getAccessToken: () => 'access',
    fetchImpl,
  });

const problem = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ code, message }), { status });

const acceptBody = (fetchImpl: jest.MockedFunction<typeof fetch>) =>
  JSON.parse(fetchImpl.mock.calls[0]![1]!.body as string) as Record<string, unknown>;

describe('join model', () => {
  it('trims the invitation code before sending it', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(backendAccept), { status: 201 }),
    ) as jest.MockedFunction<typeof fetch>;

    const outcome = await acceptInvitation(makeClient(fetchImpl), '  abc-def-123456789012  ');

    expect(fetchImpl.mock.calls[0]![0]).toBe('https://api.example.test/v1/invitations/accept');
    expect(acceptBody(fetchImpl)).toEqual({ token: 'abc-def-123456789012' });
    expect(outcome).toEqual({
      kind: 'joined',
      tenantId: 'tenant-new',
      membershipId: 'membership-new',
    });
  });

  it('keeps the code in the flow when the profile needs confirmation and completes with the same key', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        problem(409, 'PROFILE_CONFIRMATION_REQUIRED', 'Hãy xác nhận họ tên trước khi tham gia doanh nghiệp.'),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(backendAccept), { status: 201 })) as jest.MockedFunction<
      typeof fetch
    >;
    const client = makeClient(fetchImpl);

    const pending = await acceptInvitation(client, 'abc-def-123456789012', {
      idempotencyKey: 'join-key-123',
    });
    expect(pending).toEqual({ kind: 'profile-confirmation-required' });

    const joined = await completePendingJoin(client, 'abc-def-123456789012', 'join-key-123');
    expect(joined).toEqual({
      kind: 'joined',
      tenantId: 'tenant-new',
      membershipId: 'membership-new',
    });

    const bodies = fetchImpl.mock.calls.map(([, init]) =>
      JSON.parse(init!.body as string) as Record<string, unknown>,
    );
    expect(bodies.map((body) => body.token)).toEqual([
      'abc-def-123456789012',
      'abc-def-123456789012',
    ]);
    const keys = fetchImpl.mock.calls.map(
      ([, init]) => (init!.headers as Record<string, string>)['Idempotency-Key'],
    );
    expect(keys).toEqual(['join-key-123', 'join-key-123']);
  });

  it('maps an expired, revoked or exhausted code to a clear Vietnamese message', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      problem(410, 'RESOURCE_GONE', 'Lời mời không còn hiệu lực.'),
    ) as jest.MockedFunction<typeof fetch>;

    const error = await acceptInvitation(makeClient(fetchImpl), 'abc-def-123456789012').catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(JoinError);
    expect((error as JoinError).kind).toBe('gone');
    expect((error as JoinError).message).toBe('Lời mời không còn hiệu lực.');
  });

  it('maps a malformed code to a re-entry prompt without leaking technical codes', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      problem(422, 'VALIDATION_FAILED', 'Mã lời mời không hợp lệ.'),
    ) as jest.MockedFunction<typeof fetch>;

    const error = await acceptInvitation(makeClient(fetchImpl), 'short').catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(JoinError);
    expect((error as JoinError).kind).toBe('invalid');
    expect((error as JoinError).message).toBe('Mã lời mời không hợp lệ. Hãy kiểm tra lại.');
  });

  it('maps a locked account to a contact-admin message', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      problem(403, 'AUTHORIZATION_DENIED', 'Tài khoản đã bị khóa.'),
    ) as jest.MockedFunction<typeof fetch>;

    const error = await acceptInvitation(makeClient(fetchImpl), 'abc-def-123456789012').catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(JoinError);
    expect((error as JoinError).kind).toBe('locked');
    expect((error as JoinError).message).toBe(
      'Tài khoản đã bị khóa. Hãy liên hệ quản trị viên công ty.',
    );
  });

  it('maps a network failure to a retry prompt', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as jest.MockedFunction<
      typeof fetch
    >;

    const error = await acceptInvitation(makeClient(fetchImpl), 'abc-def-123456789012').catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(JoinError);
    expect((error as JoinError).kind).toBe('network');
    expect((error as JoinError).message).toBe(
      'Không thể kết nối máy chủ. Hãy kiểm tra kết nối mạng rồi thử lại.',
    );
  });

  it('uses a fresh idempotency key on every submit so double-taps cannot double-join', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(backendAccept), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...backendAccept, id: 'other' }), { status: 201 }),
      ) as jest.MockedFunction<typeof fetch>;
    const client = makeClient(fetchImpl);

    await acceptInvitation(client, 'abc-def-123456789012');
    await acceptInvitation(client, 'abc-def-123456789012');

    const keys = fetchImpl.mock.calls.map(
      ([, init]) => (init!.headers as Record<string, string>)['Idempotency-Key'],
    );
    expect(keys[0]).toBeDefined();
    expect(keys[0]!.length).toBeGreaterThanOrEqual(8);
    expect(keys[1]).toBeDefined();
    expect(keys[1]).not.toBe(keys[0]);
    expect(freshJoinIdempotencyKey().length).toBeGreaterThanOrEqual(8);
  });
});
