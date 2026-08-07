import { render } from '@testing-library/react-native';
import DashboardScreen from '@/../app/(tabs)/dashboard';
import SignInScreen from '@/../app/(auth)/sign-in';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));

describe('critical path accessibility matrix', () => {
  it('keeps headings, labelled regions and touch targets available', () => {
    expect(render(<SignInScreen />).getByRole('button')).toBeTruthy();
    const dashboard = render(<DashboardScreen />);
    expect(dashboard.getByRole('header')).toBeTruthy();
    expect(dashboard.getByLabelText('Việc cần hoàn thành')).toBeTruthy();
  });
});
