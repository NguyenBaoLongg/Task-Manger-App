import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import CreateGroupScreen from '@/../app/chat/create-group';
import { useTenantContextStore } from '@/tenant/tenant-context-store';

const members = [
  { id: 'm-b', membershipDisplayName: 'Lan Nguyễn', displayName: 'Lan Nguyễn', status: 'ACTIVE' },
  { id: 'm-c', membershipDisplayName: 'Minh Trần', displayName: 'Minh Trần', status: 'ACTIVE' },
];

const makeClient = (options: { membersError?: boolean } = {}) => {
  const request = jest
    .fn()
    .mockImplementation((path: string, requestOptions?: { method?: string }) => {
      if (path === '/memberships') {
        if (options.membersError) {
          return Promise.reject(Object.assign(new Error('denied'), { status: 403 }));
        }
        return Promise.resolve({ items: members, nextCursor: null });
      }
      if (path === '/channels' && requestOptions?.method === 'POST') {
        return Promise.resolve({ id: 'ch-new', name: 'Nhóm ca sáng' });
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    });
  const tenant = jest.fn(() => ({ request }));
  return { request, tenant };
};

jest.mock('expo-router', () => {
  const router = { back: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) };
  return { router, useRouter: () => router };
});

jest.mock('@/features/auth/session-runtime', () => ({
  getAuthenticatedClient: jest.fn(),
}));

import { getAuthenticatedClient } from '@/features/auth/session-runtime';

const getAuthenticatedClientMock = getAuthenticatedClient as jest.Mock;
const routerBack = router.back as jest.Mock;

beforeEach(() => {
  getAuthenticatedClientMock.mockReset();
  getAuthenticatedClientMock.mockResolvedValue(makeClient());
  routerBack.mockClear();
  useTenantContextStore.setState({
    context: { tenantId: 'tenant-a', membershipId: 'm-a', permissions: [], version: 1 },
  });
});

afterAll(() => {
  useTenantContextStore.setState({ context: undefined });
});

describe('create group accessibility', () => {
  it('lists coworkers as checkboxes and unlocks submit only with a valid name', async () => {
    const screen = render(<CreateGroupScreen />);
    expect(await screen.findByRole('header', { name: 'Tạo nhóm chat' })).toBeTruthy();

    const lan = await screen.findByRole('checkbox', { name: 'Lan Nguyễn' });
    expect(lan.props.accessibilityState.checked).toBe(false);

    const submit = screen.getByRole('button', { name: 'Tạo nhóm' });
    expect(submit.props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByLabelText('Tên nhóm'), 'N');
    expect(await screen.findByText('Tên nhóm cần ít nhất 2 ký tự.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tạo nhóm' }).props.accessibilityState.disabled).toBe(
      true,
    );

    fireEvent.changeText(screen.getByLabelText('Tên nhóm'), 'Nhóm ca sáng');
    expect(screen.getByRole('button', { name: 'Tạo nhóm' }).props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it('sends the selected members and returns to the conversation list', async () => {
    const client = makeClient();
    getAuthenticatedClientMock.mockResolvedValue(client);
    const screen = render(<CreateGroupScreen />);

    const lan = await screen.findByRole('checkbox', { name: 'Lan Nguyễn' });
    fireEvent.press(lan);
    expect(screen.getByRole('checkbox', { name: 'Lan Nguyễn' }).props.accessibilityState.checked).toBe(
      true,
    );

    fireEvent.changeText(screen.getByLabelText('Tên nhóm'), 'Nhóm ca sáng');
    fireEvent.press(screen.getByRole('button', { name: 'Tạo nhóm' }));

    await waitFor(() => expect(routerBack).toHaveBeenCalled());
    expect(client.tenant).toHaveBeenCalledWith('tenant-a');
    const request = client.request as jest.Mock;
    const [path, options] = request.mock.calls.find(
      (call: string[]) => call[0] === '/channels',
    ) as unknown as [string, { method?: string; body?: Record<string, unknown> }];
    expect(path).toBe('/channels');
    expect(options.method).toBe('POST');
    expect(options.body).toMatchObject({
      type: 'GROUP',
      name: 'Nhóm ca sáng',
      membershipIds: ['m-b'],
    });
  });

  it('still allows creating alone when the member list cannot be loaded', async () => {
    getAuthenticatedClientMock.mockResolvedValue(makeClient({ membersError: true }));
    const screen = render(<CreateGroupScreen />);

    expect(
      await screen.findByText(
        'Không tải được danh sách thành viên. Bạn vẫn có thể tạo nhóm chỉ có mình bạn.',
      ),
    ).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Tên nhóm'), 'Nhóm riêng');
    fireEvent.press(screen.getByRole('button', { name: 'Tạo nhóm' }));
    await waitFor(() => expect(routerBack).toHaveBeenCalled());
  });
});
