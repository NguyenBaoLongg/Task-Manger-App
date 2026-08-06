import { render } from '@testing-library/react-native';
import DashboardScreen from '@/../app/(tabs)/dashboard';

describe('dashboard accessibility', () => {
  it('exposes a heading and state regions for the action center', () => {
    const screen = render(<DashboardScreen />);
    expect(screen.getByRole('header')).toBeTruthy();
    expect(screen.getByLabelText('Việc cần hoàn thành')).toBeTruthy();
  });
});
