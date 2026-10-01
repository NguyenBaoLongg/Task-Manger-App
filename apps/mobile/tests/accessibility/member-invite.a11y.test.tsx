import { render, fireEvent } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';
import InviteMemberScreen from '@/../app/invite-member';
import WorkspaceScreen from '@/../app/(tabs)/workspace';
import { useTenantContextStore } from '@/tenant/tenant-context-store';

const roles = [
  { id: 'role-1', name: 'Nhân viên', code: 'EMPLOYEE', kind: 'CUSTOM' },
  { id: 'role-2', name: 'Quản lý', code: 'MANAGER', kind: 'CUSTOM' },
];

const invitation = {
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

const makeClient = (permissions: string[] = ['member.invite']) => ({
  tenant: jest.fn(() => ({
    request: jest
      .fn()
      .mockImplementation((path: string, options?: { method?: string }) => {
        if (path === '/me/permissions') return Promise.resolve({ codes: permissions });
        if (path === '/roles') return Promise.resolve(roles);
        if (path === '/invitations' && options?.method === 'POST') return Promise.resolve(invitation);
        return Promise.reject(new Error(`unexpected path ${path}`));
      }),
  })),
});

jest.mock('@/features/auth/session-runtime', () => ({
  getAuthenticatedClient: jest.fn(),
  clearSession: jest.fn().mockResolvedValue(undefined),
}));

import { getAuthenticatedClient } from '@/features/auth/session-runtime';

const getAuthenticatedClientMock = getAuthenticatedClient as jest.Mock;
const shareSpy = jest
  .spyOn(Share, 'share')
  .mockResolvedValue({ action: Share.sharedAction } as never) as jest.Mock;
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined) as jest.Mock;

beforeEach(() => {
  getAuthenticatedClientMock.mockReset();
  getAuthenticatedClientMock.mockResolvedValue(makeClient());
  shareSpy.mockClear();
  alertSpy.mockClear();
  useTenantContextStore.setState({
    context: { tenantId: 'tenant-a', membershipId: 'm-a', permissions: [], version: 1 },
  });
});

afterAll(() => {
  shareSpy.mockRestore();
  alertSpy.mockRestore();
  useTenantContextStore.setState({ context: undefined });
});

describe('member invite accessibility', () => {
  it('lists roles as selectable options and requires a selection before creating', async () => {
    const screen = render(<InviteMemberScreen />);
    expect(await screen.findByRole('header')).toBeTruthy();
    expect(await screen.findByText('1. Nhân viên')).toBeTruthy();
    expect(await screen.findByText('2. Quản lý')).toBeTruthy();

    const create = screen.getByRole('button', { name: 'Tạo lời mời' });
    expect(create.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByRole('radio', { name: 'Nhân viên' }));
    expect(screen.getByRole('button', { name: 'Tạo lời mời' }).props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it('exposes the generated code and a share action after creating', async () => {
    getAuthenticatedClientMock.mockResolvedValue(makeClient());
    const screen = render(<InviteMemberScreen />);
    await screen.findByText('1. Nhân viên');
    fireEvent.press(screen.getByRole('radio', { name: 'Nhân viên' }));
    fireEvent.press(screen.getByRole('button', { name: 'Tạo lời mời' }));

    expect(await screen.findByText(/ABC123/)).toBeTruthy();
    const share = await screen.findByRole('button', { name: 'Chia sẻ' });
    fireEvent.press(share);
    expect(shareSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('full-token-value') as string }),
    );
  });

  it('hides the invite entry without member.invite and shows it with the permission', async () => {
    getAuthenticatedClientMock.mockResolvedValue(makeClient([]));
    const hidden = render(<WorkspaceScreen />);
    expect(await hidden.findByRole('header')).toBeTruthy();
    expect(hidden.queryByRole('button', { name: 'Mời thành viên' })).toBeNull();

    getAuthenticatedClientMock.mockResolvedValue(makeClient(['member.invite']));
    const visible = render(<WorkspaceScreen />);
    expect(await visible.findByRole('button', { name: 'Mời thành viên' })).toBeTruthy();
  });

  it('asks for confirmation before logging out', async () => {
    getAuthenticatedClientMock.mockResolvedValue(makeClient(['member.invite']));
    const screen = render(<WorkspaceScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Dang xuat' }));
    expect(alertSpy).toHaveBeenCalledWith(
      'Xác nhận đăng xuất',
      'Bạn chắc chắn muốn đăng xuất khỏi thiết bị này?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng xuất', style: 'destructive', onPress: expect.any(Function) as never },
      ],
    );
  });
});
