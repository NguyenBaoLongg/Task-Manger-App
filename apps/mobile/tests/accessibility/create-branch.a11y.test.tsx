import { fireEvent, render, waitFor } from '@testing-library/react-native';
import CreateBranchScreen from '@/../app/(auth)/create-branch';
import BranchSelectionScreen from '@/../app/(auth)/branch-selection';
import { ApiProblemError } from '@/api/problem';

jest.mock('expo-router', () => {
  const router = {
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
    push: jest.fn(),
  };
  const React = jest.requireActual('react') as {
    useEffect: (callback: () => void | (() => void), dependencies: readonly unknown[]) => void;
  };
  return {
    router,
    useRouter: () => router,
    useFocusEffect: (callback: () => void | (() => void)) => React.useEffect(callback, [callback]),
    useLocalSearchParams: jest.fn(() => ({})),
  };
});
jest.mock('@/features/auth/session-runtime', () => ({
  getAuthenticatedClient: jest.fn(),
}));

import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import { router, useLocalSearchParams } from 'expo-router';

const getAuthenticatedClientMock = getAuthenticatedClient as jest.Mock;
const backMock = router.back as jest.Mock;
const pushMock = router.push as jest.Mock;
const paramsMock = useLocalSearchParams as jest.Mock;

const tenantClient = (handler: jest.Mock) => ({
  request: jest.fn((path: string, options?: Record<string, unknown>) =>
    handler(path, options) as Promise<unknown>,
  ),
  tenant: jest.fn(() => ({
    request: jest.fn((path: string, options?: Record<string, unknown>) =>
      handler(path, options) as Promise<unknown>,
    ),
  })),
});

beforeEach(() => {
  getAuthenticatedClientMock.mockReset();
  backMock.mockClear();
  pushMock.mockClear();
  paramsMock.mockReturnValue({});
});

describe('create branch accessibility', () => {
  it('labels the code and name fields and requires a valid code and name', async () => {
    paramsMock.mockReturnValue({ tenantId: 'tenant-1' });
    getAuthenticatedClientMock.mockResolvedValue(tenantClient(jest.fn()));
    const screen = render(<CreateBranchScreen />);
    await screen.findByRole('header');

    const submit = screen.getByRole('button', { name: 'Tạo cơ sở' });
    expect(submit.props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByLabelText('Mã cơ sở'), '1');
    expect(screen.getByRole('button', { name: 'Tạo cơ sở' }).props.accessibilityState.disabled).toBe(
      true,
    );
    fireEvent.changeText(screen.getByLabelText('Tên cơ sở'), 'x');
    expect(screen.getByRole('button', { name: 'Tạo cơ sở' }).props.accessibilityState.disabled).toBe(
      true,
    );

    fireEvent.changeText(screen.getByLabelText('Mã cơ sở'), 'cn1');
    expect(screen.getByLabelText('Mã cơ sở').props.value).toBe('CN1');
    fireEvent.changeText(screen.getByLabelText('Tên cơ sở'), 'Cơ sở 1');
    expect(screen.getByRole('button', { name: 'Tạo cơ sở' }).props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it('returns to the branch list after a successful creation', async () => {
    paramsMock.mockReturnValue({ tenantId: 'tenant-1' });
    const handler = jest.fn().mockResolvedValue({ id: 'branch-new', name: 'Cơ sở 1' });
    getAuthenticatedClientMock.mockResolvedValue(tenantClient(handler));
    const screen = render(<CreateBranchScreen />);
    await screen.findByRole('header');

    fireEvent.changeText(screen.getByLabelText('Mã cơ sở'), 'CN1');
    fireEvent.changeText(screen.getByLabelText('Tên cơ sở'), 'Cơ sở 1');
    fireEvent.press(screen.getByRole('button', { name: 'Tạo cơ sở' }));

    await waitFor(() => expect(backMock).toHaveBeenCalled());
  });

  it('announces network failures in Vietnamese', async () => {
    paramsMock.mockReturnValue({ tenantId: 'tenant-1' });
    const handler = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    getAuthenticatedClientMock.mockResolvedValue(tenantClient(handler));
    const screen = render(<CreateBranchScreen />);
    await screen.findByRole('header');

    fireEvent.changeText(screen.getByLabelText('Mã cơ sở'), 'CN1');
    fireEvent.changeText(screen.getByLabelText('Tên cơ sở'), 'Cơ sở 1');
    fireEvent.press(screen.getByRole('button', { name: 'Tạo cơ sở' }));

    expect(
      await screen.findByText('Không thể kết nối máy chủ. Hãy kiểm tra kết nối mạng rồi thử lại.'),
    ).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('tells the owner to contact an admin when the permission is missing', async () => {
    paramsMock.mockReturnValue({ tenantId: 'tenant-1' });
    const handler = jest.fn().mockRejectedValue(
      new ApiProblemError({ code: 'AUTHORIZATION_DENIED', message: 'Forbidden', status: 403 }),
    );
    getAuthenticatedClientMock.mockResolvedValue(tenantClient(handler));
    const screen = render(<CreateBranchScreen />);
    await screen.findByRole('header');

    fireEvent.changeText(screen.getByLabelText('Mã cơ sở'), 'CN1');
    fireEvent.changeText(screen.getByLabelText('Tên cơ sở'), 'Cơ sở 1');
    fireEvent.press(screen.getByRole('button', { name: 'Tạo cơ sở' }));

    expect(
      await screen.findByText(
        'Tài khoản không có quyền tạo cơ sở. Hãy liên hệ quản trị viên công ty.',
      ),
    ).toBeTruthy();
  });
});

describe('branch selection empty state', () => {
  it('offers creating the first branch when the company has none', async () => {
    paramsMock.mockReturnValue({ tenantId: 'tenant-1' });
    const client = {
      request: jest.fn(),
      tenant: jest.fn(() => ({ request: jest.fn().mockResolvedValue([]) })),
    };
    getAuthenticatedClientMock.mockResolvedValue(client);
    const screen = render(<BranchSelectionScreen />);

    expect(await screen.findByText('Công ty chưa có cơ sở nào')).toBeTruthy();
    const create = screen.getByRole('button', { name: 'Tạo cơ sở' });
    expect(create).toBeTruthy();

    fireEvent.press(create);
    expect(pushMock).toHaveBeenCalledWith({
      pathname: '/(auth)/create-branch',
      params: { tenantId: 'tenant-1', membershipId: '' },
    });
  });

  it('lists branches when the company already has them', async () => {
    paramsMock.mockReturnValue({ tenantId: 'tenant-1' });
    const client = {
      request: jest.fn(),
      tenant: jest.fn(() => ({
        request: jest
          .fn()
          .mockResolvedValue([{ id: 'branch-1', name: 'Cơ sở 1', status: 'ACTIVE' }]),
      })),
    };
    getAuthenticatedClientMock.mockResolvedValue(client);
    const screen = render(<BranchSelectionScreen />);

    expect(await screen.findByLabelText('Cơ sở 1')).toBeTruthy();
    expect(screen.queryByText('Công ty chưa có cơ sở nào')).toBeNull();
  });
});
