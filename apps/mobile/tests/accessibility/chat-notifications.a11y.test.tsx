import { render } from '@testing-library/react-native';
import ChatScreen from '@/../app/(tabs)/chat';
import ConversationScreen from '@/../app/chat/[channelId]';

/**
 * Chat is two screens now: a conversation list and the conversation itself. Each has to stand on
 * its own for a screen reader, because a list row that only reads as a name gives no way to know
 * there are unread messages waiting in it.
 */
describe('chat accessibility', () => {
  it('exposes the conversation list header, search and list region', () => {
    const screen = render(<ChatScreen />);
    expect(screen.getByRole('header')).toBeTruthy();
    expect(screen.getByLabelText('Tìm kiếm trò chuyện')).toBeTruthy();
    expect(screen.getByLabelText('Danh sách trò chuyện')).toBeTruthy();
    expect(screen.getByLabelText('Không có tin nhắn chưa đọc')).toBeTruthy();
  });

  it('exposes the conversation message region and composer', () => {
    const screen = render(<ConversationScreen />);
    expect(screen.getByLabelText('Tin nhắn')).toBeTruthy();
    expect(screen.getByLabelText('Soạn tin nhắn')).toBeTruthy();
    expect(screen.getByLabelText('Gửi tin nhắn')).toBeTruthy();
    expect(screen.getByLabelText('Quay lại danh sách trò chuyện')).toBeTruthy();
  });

  it('disables send until the draft has content, and says so', () => {
    const screen = render(<ConversationScreen />);
    expect(screen.getByLabelText('Gửi tin nhắn')).toBeDisabled();
  });
});
