import { createApiClient } from '@/api/api-client';
import { listChannelMembers, startDirectMessage } from '@/features/chat/chat-queries';

const makeClient = (fetchImpl: jest.MockedFunction<typeof fetch>) =>
  createApiClient({
    baseUrl: 'https://api.example.test',
    getAccessToken: () => 'access',
    fetchImpl,
  });

const requestBody = (fetchImpl: jest.MockedFunction<typeof fetch>) =>
  JSON.parse(fetchImpl.mock.calls[0]![1]!.body as string) as Record<string, unknown>;

describe('direct message queries', () => {
  it('opens a DIRECT channel addressed to exactly one other member', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'dm-1' }), { status: 201 }));

    const channel = await startDirectMessage(makeClient(fetchImpl), 'tenant-1', 'member-2');

    expect(fetchImpl.mock.calls[0]![0]).toBe('https://api.example.test/v1/tenants/tenant-1/channels');
    expect(requestBody(fetchImpl)).toEqual({ type: 'DIRECT', membershipIds: ['member-2'] });
    const headers = fetchImpl.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('dm-member-2');
    expect(channel).toEqual({ id: 'dm-1' });
  });

  it('lists channel members with display names', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { membershipId: 'member-1', displayName: 'Nhân viên 1', role: 'MODERATOR' },
          { membershipId: 'member-2', displayName: 'Nhân viên 2', role: 'MEMBER' },
        ]),
        { status: 200 },
      ),
    );

    const members = await listChannelMembers(makeClient(fetchImpl), 'tenant-1', 'channel-9');

    expect(fetchImpl.mock.calls[0]![0]).toBe(
      'https://api.example.test/v1/tenants/tenant-1/channels/channel-9/members',
    );
    expect(members).toHaveLength(2);
    expect(members[0]).toMatchObject({ displayName: 'Nhân viên 1' });
  });
});
