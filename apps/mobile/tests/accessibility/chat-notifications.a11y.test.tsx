import { render } from '@testing-library/react-native';
import ChatScreen from '@/../app/(tabs)/chat';

describe('chat and notification accessibility', () => {
  it('exposes chat, composer and notification badge regions', () => {
    const screen = render(<ChatScreen />);
    expect(screen.getByRole('header')).toBeTruthy();
    expect(screen.getByLabelText('Tin nhắn')).toBeTruthy();
    expect(screen.getByLabelText('Thông báo')).toBeTruthy();
  });
});
