import { render } from '@testing-library/react-native';
import DashboardScreen from '@/../app/(tabs)/dashboard';
import { ApiProblemError } from '@/api/problem';
import { useTenantContextStore } from '@/tenant/tenant-context-store';

jest.mock('@/features/auth/session-runtime', () => ({
  getAuthenticatedClient: jest.fn(),
}));

import { getAuthenticatedClient } from '@/features/auth/session-runtime';

const getAuthenticatedClientMock = getAuthenticatedClient as jest.Mock;

const tenantContext = {
  tenantId: 'tenant-1',
  membershipId: 'membership-1',
  branchId: 'branch-1',
  permissions: [],
  version: 1,
};

beforeEach(() => {
  getAuthenticatedClientMock.mockReset();
  useTenantContextStore.setState({ context: undefined });
});

describe('dashboard accessibility', () => {
  it('exposes a heading and state regions for the action center', () => {
    const screen = render(<DashboardScreen />);
    expect(screen.getByRole('header')).toBeTruthy();
    expect(screen.getByLabelText('Việc cần hoàn thành')).toBeTruthy();
  });

  it('loads the dashboard when the company has no KPI policy configured yet', async () => {
    useTenantContextStore.setState({ context: tenantContext });
    const request = jest.fn((path: string) => {
      if (path.includes('/action-items')) {
        return Promise.resolve({ openCount: 0, items: [] });
      }
      return Promise.reject(
        new ApiProblemError({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Không có policy KPI hiệu lực.',
          status: 404,
        }),
      );
    });
    getAuthenticatedClientMock.mockResolvedValue({
      request: jest.fn(),
      tenant: jest.fn(() => ({ request })),
    });

    const screen = render(<DashboardScreen />);
    expect(await screen.findByRole('header')).toBeTruthy();
    expect(screen.getByLabelText('Việc cần hoàn thành')).toBeTruthy();
    expect(screen.getByText('Chưa có việc cần hoàn thành')).toBeTruthy();
  });
});
