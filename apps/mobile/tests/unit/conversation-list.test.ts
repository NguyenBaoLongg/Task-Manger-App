import {
  avatarIndexFor,
  initialsFor,
  matchesQuery,
  timeLabelFor,
  toConversationRow,
  type Conversation,
} from '@/features/chat/conversation-list';

const NOW = new Date('2026-08-12T14:30:00');

const conversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 'channel-1',
  name: 'Team APPs tổng',
  type: 'GROUP',
  unreadCount: 0,
  lastMessage: {
    id: 'message-1',
    body: 'oke m',
    authorMembershipId: 'member-other',
    authorDisplayName: 'A Giang',
    createdAt: '2026-08-12T09:57:00',
  },
  ...overrides,
});

describe('initialsFor', () => {
  it('takes the first and last word for a multi word name', () => {
    expect(initialsFor('Báo cáo code và commit')).toBe('BC');
  });

  it('takes two characters for a single word so it is not one letter', () => {
    expect(initialsFor('test')).toBe('TE');
  });

  it('falls back rather than crashing on an empty name', () => {
    expect(initialsFor('   ')).toBe('?');
  });
});

describe('avatarIndexFor', () => {
  it('is stable for the same id', () => {
    expect(avatarIndexFor('channel-1')).toBe(avatarIndexFor('channel-1'));
  });

  it('stays within the palette', () => {
    for (const id of ['a', 'channel-1', 'a-very-long-uuid-like-value-0000']) {
      expect(avatarIndexFor(id)).toBeGreaterThanOrEqual(0);
      expect(avatarIndexFor(id)).toBeLessThan(6);
    }
  });
});

describe('timeLabelFor', () => {
  it('shows a clock time for today', () => {
    expect(timeLabelFor('2026-08-12T09:05:00', NOW)).toBe('09:05');
  });

  it('shows a weekday within the last six days', () => {
    // 2026-08-09 is a Sunday.
    expect(timeLabelFor('2026-08-09T09:05:00', NOW)).toBe('CN');
  });

  it('shows a date beyond that', () => {
    expect(timeLabelFor('2026-07-02T09:05:00', NOW)).toBe('02/07');
  });

  it('returns nothing for a missing or unparseable value', () => {
    expect(timeLabelFor(undefined, NOW)).toBe('');
    expect(timeLabelFor('not a date', NOW)).toBe('');
  });
});

describe('toConversationRow', () => {
  it('prefixes the author so a group preview says who spoke', () => {
    const row = toConversationRow(conversation(), { viewerMembershipId: 'member-me', now: NOW });
    expect(row.preview).toBe('A Giang: oke m');
  });

  it('prefixes the viewer own message with Bạn', () => {
    const row = toConversationRow(
      conversation({
        lastMessage: {
          id: 'message-2',
          body: 'Báo cáo Long 10/8',
          authorMembershipId: 'member-me',
          authorDisplayName: 'Long',
          createdAt: '2026-08-12T10:51:00',
        },
      }),
      { viewerMembershipId: 'member-me', now: NOW },
    );
    expect(row.preview).toBe('Bạn: Báo cáo Long 10/8');
    expect(row.lastMessageIsOwn).toBe(true);
  });

  it('collapses newlines so a multi line message stays on one preview line', () => {
    const row = toConversationRow(
      conversation({
        lastMessage: {
          id: 'message-3',
          body: 'GHI NHẬN\n\nTHÔNG TIN',
          authorMembershipId: 'member-other',
          authorDisplayName: 'bot',
          createdAt: '2026-08-12T11:46:00',
        },
      }),
      { now: NOW },
    );
    expect(row.preview).toBe('bot: GHI NHẬN THÔNG TIN');
  });

  it('says so when a conversation has no messages yet', () => {
    const row = toConversationRow(conversation({ lastMessage: null }), { now: NOW });
    expect(row.preview).toBe('Chưa có tin nhắn');
    expect(row.timeLabel).toBe('');
  });

  it('carries the unread count through, defaulting to zero', () => {
    expect(toConversationRow(conversation({ unreadCount: 5 }), { now: NOW }).unreadCount).toBe(5);
    expect(
      toConversationRow(conversation({ unreadCount: undefined }), { now: NOW }).unreadCount,
    ).toBe(0);
  });

  it('does not mark a message own when the viewer is unknown', () => {
    const row = toConversationRow(
      conversation({
        lastMessage: {
          id: 'message-4',
          body: 'hi',
          authorMembershipId: 'member-me',
          authorDisplayName: 'Long',
          createdAt: '2026-08-12T10:00:00',
        },
      }),
      { now: NOW },
    );
    expect(row.lastMessageIsOwn).toBe(false);
    expect(row.preview).toBe('Long: hi');
  });
});

describe('matchesQuery', () => {
  const row = toConversationRow(conversation(), { now: NOW });

  it('matches everything when the query is blank', () => {
    expect(matchesQuery(row, '   ')).toBe(true);
  });

  it('matches on the conversation name', () => {
    expect(matchesQuery(row, 'apps')).toBe(true);
  });

  it('matches on the preview text', () => {
    expect(matchesQuery(row, 'giang')).toBe(true);
  });

  it('matches a Vietnamese name typed without diacritics', () => {
    expect(matchesQuery(row, 'team apps tong')).toBe(true);
  });

  it('rejects a name that is not there', () => {
    expect(matchesQuery(row, 'booking')).toBe(false);
  });
});

describe('direct messages', () => {
  it('drops the group prefix and repeats no author name in a DM preview', () => {
    const row = toConversationRow(
      conversation({
        type: 'DIRECT',
        name: 'A Giang',
        lastMessage: {
          id: 'message-2',
          body: 'Cho mình hỏi ca chiều nhé',
          authorMembershipId: 'member-other',
          authorDisplayName: 'A Giang',
          createdAt: '2026-08-12T10:00:00',
        },
      }),
      { viewerMembershipId: 'member-me', now: NOW },
    );
    expect(row.isGroup).toBe(false);
    expect(row.name).toBe('A Giang');
    expect(row.preview).toBe('Cho mình hỏi ca chiều nhé');
  });

  it('still marks the viewer as the author of their own DM', () => {
    const row = toConversationRow(
      conversation({
        type: 'DIRECT',
        name: 'A Giang',
        lastMessage: {
          id: 'message-3',
          body: 'Đã nhận',
          authorMembershipId: 'member-me',
          authorDisplayName: 'Tôi',
          createdAt: '2026-08-12T10:05:00',
        },
      }),
      { viewerMembershipId: 'member-me', now: NOW },
    );
    expect(row.preview).toBe('Bạn: Đã nhận');
  });
});

describe('media previews', () => {
  const lastOf = (messageType: string, body: string) => ({
    id: 'message-4',
    body,
    messageType,
    authorMembershipId: 'member-other',
    authorDisplayName: 'A Giang',
    createdAt: '2026-08-12T11:00:00',
  });

  it('labels image, video, voice and file messages instead of showing an empty body', () => {
    expect(toConversationRow(conversation({ lastMessage: lastOf('IMAGE', '') }), { now: NOW }).preview).toBe(
      'A Giang: 📷 Ảnh',
    );
    expect(toConversationRow(conversation({ lastMessage: lastOf('VIDEO', '') }), { now: NOW }).preview).toBe(
      'A Giang: 🎬 Video',
    );
    expect(
      toConversationRow(conversation({ lastMessage: lastOf('AUDIO', '') }), { now: NOW }).preview,
    ).toBe('A Giang: 🎤 Tin nhắn thoại');
    expect(toConversationRow(conversation({ lastMessage: lastOf('FILE', '') }), { now: NOW }).preview).toBe(
      'A Giang: 📎 File',
    );
  });

  it('keeps the viewer prefix and a caption when one was typed', () => {
    expect(
      toConversationRow(
        conversation({
          lastMessage: { ...lastOf('IMAGE', 'Báo cáo hôm nay'), authorMembershipId: 'member-me' },
        }),
        {
          viewerMembershipId: 'member-me',
          now: NOW,
        },
      ).preview,
    ).toBe('Bạn: 📷 Báo cáo hôm nay');
  });

  it('leaves text messages untouched', () => {
    expect(
      toConversationRow(conversation({ lastMessage: lastOf('TEXT', 'Chào buổi sáng') }), {
        now: NOW,
      }).preview,
    ).toBe('A Giang: Chào buổi sáng');
  });
});
