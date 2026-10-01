import { fireEvent, render, waitFor } from '@testing-library/react-native';
import CreateCompanyScreen from '@/../app/(auth)/create-company';
import WorkspaceSelectionScreen from '@/../app/(auth)/workspace-selection';
import { ApiProblemError } from '@/api/problem';

jest.mock('expo-router', () => {
  const router = {
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
    push: jest.fn(),
  };
  return { router, useRouter: () => router };
});
jest.mock('@/features/auth/session-runtime', () => ({
  getAuthenticatedClient: jest.fn(),
}));

import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import { router } from 'expo-router';

const getAuthenticatedClientMock = getAuthenticatedClient as jest.Mock;
const replaceMock = router.replace as jest.Mock;

const tenantClient = (handler: jest.Mock) => ({
  request: jest.fn((path: string, options?: Record<string, unknown>) =>
    handler(path, options) as Promise<unknown>,
  ),
  tenant: jest.fn(() => ({ request: jest.fn().mockResolvedValue([]) })),
});

const workspaceClient = (tenants: unknown[]) => ({
  request: jest.fn().mockResolvedValue(tenants),
  tenant: jest.fn(() => ({ request: jest.fn().mockResolvedValue([]) })),
});

const problemError = (status: number, code: string, message: string) =>
  new ApiProblemError({ code, message, status });

beforeEach(() => {
  getAuthenticatedClientMock.mockReset();
  replaceMock.mockClear();
});

describe('create company accessibility', () => {
  it('offers both joining and creating a company when the workspace list is empty', async () => {
    getAuthenticatedClientMock.mockResolvedValue(workspaceClient([]));
    const screen = render(<WorkspaceSelectionScreen />);

    expect(await screen.findByRole('button', { name: 'Tạo công ty' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tham gia công ty' })).toBeTruthy();
  });

  it('labels the company name and timezone fields and requires a valid name', async () => {
    getAuthenticatedClientMock.mockResolvedValue(tenantClient(jest.fn()));
    const screen = render(<CreateCompanyScreen />);
    await screen.findByRole('header');

    const submit = screen.getByRole('button', { name: 'Tạo công ty' });
    expect(submit.props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByLabelText('Tên công ty'), 'x');
    expect(screen.getByRole('button', { name: 'Tạo công ty' }).props.accessibilityState.disabled).toBe(
      true,
    );

    fireEvent.changeText(screen.getByLabelText('Tên công ty'), 'Công ty Demo');
    expect(screen.getByRole('button', { name: 'Tạo công ty' }).props.accessibilityState.disabled).toBe(
      false,
    );
    expect(screen.getByLabelText('Múi giờ').props.value).toBe('Asia/Ho_Chi_Minh');
  });

  it('returns to workspace selection after a successful creation', async () => {
    const handler = jest.fn().mockResolvedValue({
      tenant: { id: 'tenant-new' },
      membership: { id: 'membership-new' },
    });
    getAuthenticatedClientMock.mockResolvedValue(tenantClient(handler));
    const screen = render(<CreateCompanyScreen />);
    await screen.findByRole('header');

    fireEvent.changeText(screen.getByLabelText('Tên công ty'), '  Công ty Demo  ');
    fireEvent.press(screen.getByRole('button', { name: 'Tạo công ty' }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/(auth)/workspace-selection'));
  });

  it('announces network failures in Vietnamese', async () => {
    const handler = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    getAuthenticatedClientMock.mockResolvedValue(tenantClient(handler));
    const screen = render(<CreateCompanyScreen />);
    await screen.findByRole('header');

    fireEvent.changeText(screen.getByLabelText('Tên công ty'), 'Công ty Demo');
    fireEvent.press(screen.getByRole('button', { name: 'Tạo công ty' }));

    expect(
      await screen.findByText('Không thể kết nối máy chủ. Hãy kiểm tra kết nối mạng rồi thử lại.'),
    ).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('routes to profile confirmation when the profile is unconfirmed', async () => {
    const handler = jest.fn().mockRejectedValue(
      problemError(
        409,
        'PROFILE_CONFIRMATION_REQUIRED',
        'Cần xác nhận họ tên trước khi tạo doanh nghiệp.',
      ),
    );
    getAuthenticatedClientMock.mockResolvedValue(tenantClient(handler));
    const screen = render(<CreateCompanyScreen />);
    await screen.findByRole('header');

    fireEvent.changeText(screen.getByLabelText('Tên công ty'), 'Công ty Demo');
    fireEvent.press(screen.getByRole('button', { name: 'Tạo công ty' }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/(auth)/profile-confirmation'));
  });
});
