/**
 * Pure shaping for the conversation list. Kept out of the screen so the rules that decide what a row
 * says — and how a timestamp reads — can be tested without rendering anything.
 */

export type Conversation = {
  id: string;
  name: string;
  type?: string;
  unreadCount?: number;
  lastMessage?: {
    id: string;
    body: string;
    messageType?: string;
    authorMembershipId: string;
    authorDisplayName: string;
    createdAt: string;
  } | null;
  lastActivityAt?: string;
};

export type ConversationRow = {
  id: string;
  name: string;
  initials: string;
  /** Colour index for the avatar, stable per conversation. */
  avatarIndex: number;
  preview: string;
  timeLabel: string;
  unreadCount: number;
  isGroup: boolean;
  /** True when the last message is the viewer's own, which is what a read receipt attaches to. */
  lastMessageIsOwn: boolean;
};

const AVATAR_PALETTE_SIZE = 6;

/**
 * Two initials from the conversation name, matching what a chat app shows when there is no photo.
 * A single-word name contributes its first two characters so "test" does not collapse to "T".
 */
export const initialsFor = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return '?';
  if (words.length === 1) return first.slice(0, 2).toUpperCase();
  const last = words[words.length - 1] ?? first;
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
};

/**
 * A stable colour per conversation. Deriving it from the id rather than list position keeps a row's
 * colour from changing when the list reorders, which it does on every new message.
 */
export const avatarIndexFor = (id: string): number => {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) % 997;
  return hash % AVATAR_PALETTE_SIZE;
};

/**
 * Chat lists do not show a full date. Today is a clock time, the last week is a weekday, and older
 * than that is a date — so the column stays narrow and scannable.
 */
export const timeLabelFor = (iso: string | undefined, now: Date): string => {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (at >= startOfToday) {
    return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  }

  const sixDaysAgo = new Date(startOfToday);
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
  if (at >= sixDaysAgo) {
    const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;
    return weekdays[at.getDay()] ?? '';
  }

  return `${String(at.getDate()).padStart(2, '0')}/${String(at.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Media messages show what they are rather than their (often empty) body; a caption, when the
 * sender typed one, follows the glyph.
 */
export const mediaPreviewFor = (messageType: string | undefined, body: string): string => {
  if (messageType === 'IMAGE') return body ? `📷 ${body}` : '📷 Ảnh';
  if (messageType === 'VIDEO') return body ? `🎬 ${body}` : '🎬 Video';
  if (messageType === 'AUDIO') return '🎤 Tin nhắn thoại';
  if (messageType === 'FILE') return body ? `📎 ${body}` : '📎 File';
  return body;
};

/**
 * The preview line. A group prefixes the author so the reader knows who spoke without opening it;
 * the viewer's own message is prefixed "Bạn" the way every chat client does.
 */
const previewFor = (conversation: Conversation, viewerMembershipId?: string): string => {
  const last = conversation.lastMessage;
  if (!last) return 'Chưa có tin nhắn';

  const body = mediaPreviewFor(last.messageType, last.body.replace(/\s+/g, ' ').trim());
  const isOwn = Boolean(viewerMembershipId) && last.authorMembershipId === viewerMembershipId;
  if (isOwn) return `Bạn: ${body}`;
  // In a DM the row already carries the peer's name; the prefix would repeat it.
  if (conversation.type === 'DIRECT') return body;
  return `${last.authorDisplayName}: ${body}`;
};

export const toConversationRow = (
  conversation: Conversation,
  options: { viewerMembershipId?: string; now?: Date } = {},
): ConversationRow => {
  const now = options.now ?? new Date();
  const last = conversation.lastMessage;

  return {
    id: conversation.id,
    name: conversation.name,
    initials: initialsFor(conversation.name),
    avatarIndex: avatarIndexFor(conversation.id),
    preview: previewFor(conversation, options.viewerMembershipId),
    timeLabel: timeLabelFor(last?.createdAt ?? conversation.lastActivityAt, now),
    unreadCount: conversation.unreadCount ?? 0,
    isGroup: conversation.type !== 'DIRECT',
    lastMessageIsOwn:
      Boolean(options.viewerMembershipId) && last?.authorMembershipId === options.viewerMembershipId,
  };
};

/** Case- and accent-insensitive enough for Vietnamese names typed without diacritics. */
export const matchesQuery = (row: ConversationRow, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const normalise = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const haystack = normalise(`${row.name} ${row.preview}`.toLowerCase());
  return haystack.includes(normalise(needle));
};
