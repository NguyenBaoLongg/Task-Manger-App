import { render } from '@testing-library/react-native';
import SignInScreen from '@/../app/(auth)/sign-in';
import WorkspaceSelectionScreen from '@/../app/(auth)/workspace-selection';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/features/auth/session-runtime', () => ({
  getAuthenticatedClient: jest.fn().mockResolvedValue({
    request: jest
      .fn()
      .mockResolvedValue([{ tenantId: 'tenant-a', membershipId: 'm-a', name: 'Adsup Demo' }]),
    tenant: jest.fn(() => ({ request: jest.fn().mockResolvedValue([]) })),
  }),
}));

describe('auth and workspace accessibility', () => {
  it('exposes a named sign-in action and heading', () => {
    const screen = render(<SignInScreen />);
    expect(screen.getByRole('header')).toBeTruthy();
    expect(screen.getByRole('button', { name: /đăng nhập/i })).toBeTruthy();
  });

  it('exposes workspace options as buttons with readable labels', async () => {
    const screen = render(<WorkspaceSelectionScreen />);
    expect(await screen.findByRole('header')).toBeTruthy();
    expect(await screen.findByRole('button', { name: /Adsup Demo/i })).toBeTruthy();
  });
});
