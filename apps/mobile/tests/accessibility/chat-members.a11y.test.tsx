import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import ChannelMembersScreen from '@/../app/chat/[channelId]/members';
import { useTenantContextStore } from '@/tenant/tenant-context-store';

const channelMembers = [
  { membershipId: 'm-a', displayName: 'Nhân viên 1', role: 'MODERATOR' },
  { membershipId: 'm-b', displayName: 'Nhân viên 2', role: 'MEMBER' },
];

const makeClient = (options: { dmError?: boolean } = {}) => {
  const request = jest
    .fn()
    .mockImplementation((path: string, requestOptions?: { method?: string }) => {
      if (path === '/channels/channel-1/members') {
        return Promise.resolve(channelMembers);
      }
      if (path === '/channels' && requestOptions?.method === 'POST') {
        if (options.dmError) {
          return Promise.reject(Object.assign(new Error('denied'), { status: 403 }));
        }
        return Promise.resolve({ id: 'dm-1' });
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    });
  const tenant = jest.fn(() => ({ request }));
  return { request, tenant };
};

jest.mock('expo-router', () => {
  const router = {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
  };
  return {
    router,
    useRouter: () => router,
    useLocalSearchParams: () => ({ channelId: 'channel-1' }),
  };
});

jest.mock('@/features/auth/session-runtime', () => ({
  getAuthenticatedClient: jest.fn(),
}));

import { getAuthenticatedClient } from '@/features/auth/session-runtime';

const getAuthenticatedClientMock = getAuthenticatedClient as jest.Mock;
const routerReplace = router.replace as jest.Mock;

beforeEach(() => {
  getAuthenticatedClientMock.mockReset();
  getAuthenticatedClientMock.mockResolvedValue(makeClient());
  routerReplace.mockClear();
  useTenantContextStore.setState({
    context: { tenantId: 'tenant-a', membershipId: 'm-a', permissions: [], version: 1 },
  });
});

afterAll(() => {
  useTenantContextStore.setState({ context: undefined });
});

describe('channel members accessibility', () => {
  it('marks the viewer and offers a direct message button to others', async () => {
    const screen = render(<ChannelMembersScreen />);
    expect(await screen.findByRole('header', { name: 'Thành viên' })).toBeTruthy();

    expect(await screen.findByText('Nhân viên 1 (Bạn)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nhắn tin riêng với Nhân viên 2' })).toBeTruthy();
    expect(screen.queryByLabelText('Nhắn tin riêng với Nhân viên 1')).toBeNull();
  });

  it('opens the direct conversation and replaces this screen', async () => {
    const client = makeClient();
    getAuthenticatedClientMock.mockResolvedValue(client);
    const screen = render(<ChannelMembersScreen />);

    fireEvent.press(await screen.findByRole('button', { name: 'Nhắn tin riêng với Nhân viên 2' }));

    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith('/chat/dm-1'));
    const request = client.request as jest.Mock;
    const call = request.mock.calls.find(
      (item: string[]) => item[0] === '/channels',
    ) as unknown as [string, { method?: string; body?: Record<string, unknown> }];
    expect(call[1].method).toBe('POST');
    expect(call[1].body).toMatchObject({ type: 'DIRECT', membershipIds: ['m-b'] });
  });

  it('keeps the list usable when the direct message cannot be opened', async () => {
    getAuthenticatedClientMock.mockResolvedValue(makeClient({ dmError: true }));
    const screen = render(<ChannelMembersScreen />);

    fireEvent.press(await screen.findByRole('button', { name: 'Nhắn tin riêng với Nhân viên 2' }));

    expect(
      await screen.findByText('Không mở được cuộc trò chuyện với Nhân viên 2. Hãy thử lại.'),
    ).toBeTruthy();
    expect(routerReplace).not.toHaveBeenCalled();
  });
});
