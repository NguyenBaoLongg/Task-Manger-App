import { createApiClient } from '@/api/api-client';
import {
  createGroup,
  freshGroupIdempotencyKey,
  listGroupCandidates,
  validateGroupName,
} from '@/features/chat/create-group-model';

const makeClient = (fetchImpl: jest.MockedFunction<typeof fetch>) =>
  createApiClient({
    baseUrl: 'https://api.example.test',
    getAccessToken: () => 'access',
    fetchImpl,
  });

const problem = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ code, message }), { status });

const requestBody = (fetchImpl: jest.MockedFunction<typeof fetch>) =>
  JSON.parse(fetchImpl.mock.calls[0]![1]!.body as string) as Record<string, unknown>;

describe('create group model', () => {
  it('rejects names outside the 2-120 range before any request', () => {
    expect(validateGroupName('  a ')).toBe('Tên nhóm cần ít nhất 2 ký tự.');
    expect(validateGroupName(''.padEnd(121, 'x'))).toBe('Tên nhóm tối đa 120 ký tự.');
    expect(validateGroupName('Nhóm ca sáng')).toBeUndefined();
  });

  it('posts a GROUP channel with trimmed name and selected members', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'ch-1', name: 'Nhóm ca sáng' }), { status: 201 }));

    const created = await createGroup(
      makeClient(fetchImpl),
      'tenant-1',
      { name: '  Nhóm ca sáng  ', membershipIds: ['m-2', 'm-3'], idempotencyKey: 'group-key-1' },
    );

    expect(fetchImpl.mock.calls[0]![0]).toBe('https://api.example.test/v1/tenants/tenant-1/channels');
    expect(requestBody(fetchImpl)).toEqual({
      type: 'GROUP',
      name: 'Nhóm ca sáng',
      membershipIds: ['m-2', 'm-3'],
    });
    expect((fetchImpl.mock.calls[0]![1]!.headers as Record<string, string>)['Idempotency-Key']).toBe(
      'group-key-1',
    );
    expect(created).toEqual({ id: 'ch-1', name: 'Nhóm ca sáng' });
  });

  it('fails locally on an invalid name without touching the network', async () => {
    const fetchImpl = jest.fn();

    await expect(
      createGroup(makeClient(fetchImpl as unknown as jest.MockedFunction<typeof fetch>), 'tenant-1', {
        name: 'a',
        membershipIds: [],
        idempotencyKey: 'group-key-1',
      }),
    ).rejects.toMatchObject({ kind: 'unknown', message: 'Tên nhóm cần ít nhất 2 ký tự.' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps authorization denial to a permission message', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(problem(403, 'AUTHORIZATION_DENIED', 'Thiếu quyền chat.manage.'));

    await expect(
      createGroup(makeClient(fetchImpl), 'tenant-1', {
        name: 'Nhóm demo',
        membershipIds: [],
        idempotencyKey: 'group-key-1',
      }),
    ).rejects.toMatchObject({
      kind: 'locked',
      message: 'Bạn không có quyền tạo nhóm chat.',
    });
  });

  it('maps an inactive selected member to a retryable message', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(problem(404, 'RESOURCE_NOT_FOUND', 'Có thành viên kênh không hợp lệ.'));

    await expect(
      createGroup(makeClient(fetchImpl), 'tenant-1', {
        name: 'Nhóm demo',
        membershipIds: ['m-gone'],
        idempotencyKey: 'group-key-1',
      }),
    ).rejects.toMatchObject({ kind: 'invalid-member' });
  });

  it('maps transport failure to a network message', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    await expect(
      createGroup(makeClient(fetchImpl), 'tenant-1', {
        name: 'Nhóm demo',
        membershipIds: [],
        idempotencyKey: 'group-key-1',
      }),
    ).rejects.toMatchObject({ kind: 'network' });
  });

  it('produces a fresh idempotency key per call', () => {
    expect(freshGroupIdempotencyKey()).not.toBe(freshGroupIdempotencyKey());
    expect(freshGroupIdempotencyKey()).toMatch(/^chat-group-/);
  });

  it('lists active members other than the viewer as candidates', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            { id: 'm-1', membershipDisplayName: 'Tôi', displayName: 'Tôi', status: 'ACTIVE' },
            { id: 'm-2', membershipDisplayName: 'Lan', displayName: 'Lan', status: 'ACTIVE' },
            { id: 'm-3', membershipDisplayName: 'Cũ', displayName: 'Cũ', status: 'LEFT' },
          ],
          nextCursor: null,
        }),
        { status: 200 },
      ),
    );

    const members = await listGroupCandidates(makeClient(fetchImpl), 'tenant-1', 'm-1');

    expect(members).toEqual([{ id: 'm-2', displayName: 'Lan' }]);
  });
});
