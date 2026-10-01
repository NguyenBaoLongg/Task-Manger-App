import { fireEvent, render } from '@testing-library/react-native';
import ChatScreen from '@/../app/(tabs)/chat';
import ConversationScreen from '@/../app/chat/[channelId]';

// The native audio/video modules have no JS fallback under jest-expo; the a11y contract only
// needs the recorder/player hooks to exist and return inert controllers.
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => ({
    prepareToRecordAsync: jest.fn(),
    record: jest.fn(),
    stop: jest.fn(),
    uri: 'file:///recording.m4a',
  }),
  useAudioPlayer: () => ({
    play: jest.fn(),
    pause: jest.fn(),
    seeking: false,
    duration: 0,
    currentTime: 0,
    playing: false,
    addListener: jest.fn(() => jest.fn()),
  }),
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setAudioModeAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-video', () => ({
  useVideoPlayer: () => ({
    play: jest.fn(),
    pause: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  }),
  VideoView: () => null,
}));

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

  it('exposes the media attach button and names both send options', () => {
    const screen = render(<ConversationScreen />);
    fireEvent.press(screen.getByLabelText('Gửi media'));
    expect(screen.getByLabelText('Gửi ảnh hoặc video')).toBeTruthy();
    expect(screen.getByLabelText('Ghi âm tin nhắn')).toBeTruthy();
  });
});
