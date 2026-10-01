import { fireEvent, render } from '@testing-library/react-native';
import SignInScreen from '@/../app/(auth)/sign-in';
import WorkspaceSelectionScreen from '@/../app/(auth)/workspace-selection';

jest.mock('expo-router', () => {
  const router = { replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) };
  return { router, useRouter: () => router };
});
jest.mock('@/features/auth/session-runtime', () => ({
  getAuthenticatedClient: jest.fn().mockResolvedValue({
    request: jest
      .fn()
      .mockResolvedValue([{ tenantId: 'tenant-a', membershipId: 'm-a', name: 'Adsup Demo' }]),
    tenant: jest.fn(() => ({ request: jest.fn().mockResolvedValue([]) })),
  }),
  saveSession: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/auth/provider-factory', () => ({
  createGoogleProvider: jest.fn(() => ({
    signIn: jest.fn(() => new Promise<never>(() => undefined)),
    signOut: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('auth and workspace accessibility', () => {
  it('exposes a named Google sign-in action and heading', () => {
    const screen = render(<SignInScreen />);
    expect(screen.getByRole('header')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Đăng nhập bằng Google' });
    expect(button).toBeTruthy();
    expect(button.props.accessibilityState.disabled).toBe(false);
  });

  it('disables the sign-in button and announces progress while busy', async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    try {
      const screen = render(<SignInScreen />);
      const button = screen.getByRole('button', { name: 'Đăng nhập bằng Google' });
      fireEvent.press(button);
      expect(await screen.findByRole('button', { name: /đang kết nối/i })).toBeTruthy();
      expect(
        screen.getByRole('button', { name: /đang kết nối/i }).props.accessibilityState.disabled,
      ).toBe(true);
    } finally {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    }
  });

  it('exposes workspace options as buttons with readable labels', async () => {
    const screen = render(<WorkspaceSelectionScreen />);
    expect(await screen.findByRole('header')).toBeTruthy();
    expect(await screen.findByRole('button', { name: /Adsup Demo/i })).toBeTruthy();
  });
});
