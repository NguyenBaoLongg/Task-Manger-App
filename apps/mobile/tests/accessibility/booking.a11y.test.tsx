import { render, waitFor } from '@testing-library/react-native';
import BookingCalendarScreen from '@/../app/booking/calendar';

describe('booking accessibility', () => {
  it('exposes calendar heading, date filter and create action', async () => {
    const screen = render(<BookingCalendarScreen />);
    await waitFor(() => expect(screen.getByRole('header')).toBeTruthy());
    expect(screen.getByLabelText('Ngày làm việc')).toBeTruthy();
    expect(screen.getByText('Tạo booking')).toBeTruthy();
  });
});
