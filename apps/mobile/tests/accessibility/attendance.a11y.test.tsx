import { render } from '@testing-library/react-native';
import AttendanceScreen from '@/../app/attendance/index';

describe('attendance accessibility', () => {
  it('exposes check-in, leave and penalty regions with readable labels', () => {
    const screen = render(<AttendanceScreen />);
    expect(screen.getByRole('header')).toBeTruthy();
    expect(screen.getByLabelText('Chấm công video')).toBeTruthy();
    expect(screen.getByLabelText('Nghỉ và duyệt')).toBeTruthy();
    expect(screen.getByLabelText('Sổ phạt')).toBeTruthy();
  });
});
