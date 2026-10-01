import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import JoinCompanyScreen from '@/../app/(auth)/join-company';
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
const pushMock = router.push as jest.Mock;

const acceptClient = (handler: jest.Mock) => ({
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
  pushMock.mockClear();
});

describe('member join accessibility', () => {
  it('shows the join entry only when the loaded workspace list is empty', async () => {
    getAuthenticatedClientMock.mockResolvedValue(workspaceClient([]));
    const empty = render(<WorkspaceSelectionScreen />);
    expect(await empty.findByRole('button', { name: 'Tham gia công ty' })).toBeTruthy();

    getAuthenticatedClientMock.mockResolvedValue(
      workspaceClient([{ tenantId: 'tenant-a', membershipId: 'm-a', name: 'Adsup Demo' }]),
    );
    const joined = render(<WorkspaceSelectionScreen />);
    expect(await joined.findByRole('button', { name: /Adsup Demo/i })).toBeTruthy();
    expect(joined.queryByRole('button', { name: 'Tham gia công ty' })).toBeNull();
  });

  it('requires a code before submitting', async () => {
    getAuthenticatedClientMock.mockResolvedValue(acceptClient(jest.fn()));
    const screen = render(<JoinCompanyScreen />);
    await screen.findByRole('header');

    const submit = screen.getByRole('button', { name: 'Tham gia' });
    expect(submit.props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByLabelText('Mã lời mời'), 'abc-def-123456789012');
    expect(screen.getByRole('button', { name: 'Tham gia' }).props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it('announces an expired code in Vietnamese and allows re-entry', async () => {
    const handler = jest
      .fn()
      .mockRejectedValue(problemError(410, 'RESOURCE_GONE', 'Lời mời không còn hiệu lực.'));
    getAuthenticatedClientMock.mockResolvedValue(acceptClient(handler));
    const screen = render(<JoinCompanyScreen />);
    await screen.findByRole('header');

    fireEvent.changeText(screen.getByLabelText('Mã lời mời'), 'expired-code-1234567890');
    fireEvent.press(screen.getByRole('button', { name: 'Tham gia' }));

    expect(await screen.findByText('Lời mời không còn hiệu lực.')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tham gia' }).props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it('announces network failures in Vietnamese', async () => {
    const handler = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    getAuthenticatedClientMock.mockResolvedValue(acceptClient(handler));
    const screen = render(<JoinCompanyScreen />);
    await screen.findByRole('header');

    fireEvent.changeText(screen.getByLabelText('Mã lời mời'), 'abc-def-123456789012');
    fireEvent.press(screen.getByRole('button', { name: 'Tham gia' }));

    expect(
      await screen.findByText('Không thể kết nối máy chủ. Hãy kiểm tra kết nối mạng rồi thử lại.'),
    ).toBeTruthy();
  });

  it('routes to profile confirmation with the pending code when the profile is unconfirmed', async () => {
    const handler = jest.fn().mockRejectedValue(
      problemError(
        409,
        'PROFILE_CONFIRMATION_REQUIRED',
        'Hãy xác nhận họ tên trước khi tham gia doanh nghiệp.',
      ),
    );
    getAuthenticatedClientMock.mockResolvedValue(acceptClient(handler));
    const screen = render(<JoinCompanyScreen />);
    await screen.findByRole('header');

    fireEvent.changeText(screen.getByLabelText('Mã lời mời'), ' abc-def-123456789012 ');
    fireEvent.press(screen.getByRole('button', { name: 'Tham gia' }));

    await screen.findByRole('header');
    expect(pushMock).toHaveBeenCalledWith({
      pathname: '/(auth)/profile-confirmation',
      params: {
        pendingJoinToken: 'abc-def-123456789012',
        pendingJoinKey: expect.stringMatching(/^mobile-join-/) as string,
      },
    });
  });

  it('blocks repeated presses while a submit is in flight', async () => {
    let resolveRequest: (value: unknown) => void = () => undefined;
    const handler = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    getAuthenticatedClientMock.mockResolvedValue(acceptClient(handler));
    const screen = render(<JoinCompanyScreen />);
    await screen.findByRole('header');

    fireEvent.changeText(screen.getByLabelText('Mã lời mời'), 'abc-def-123456789012');
    const submit = screen.getByRole('button', { name: 'Tham gia' });
    fireEvent.press(submit);
    fireEvent.press(submit);

    expect(
      screen.getByRole('button', { name: /đang xử lý/i }).props.accessibilityState.disabled,
    ).toBe(true);
    await waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByRole('button', { name: /đang xử lý/i }));
    expect(handler).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest({
        id: 'membership-new',
        tenantId: 'tenant-new',
      });
    });
  });
});
