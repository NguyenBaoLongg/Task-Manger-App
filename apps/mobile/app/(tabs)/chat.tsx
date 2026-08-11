import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getRuntimeConfig } from '@/config/runtime-config';
import { getAuthenticatedClient, getSessionAccessToken } from '@/features/auth/session-runtime';
import { listChannels } from '@/features/chat/chat-queries';
import {
  matchesQuery,
  toConversationRow,
  type Conversation,
  type ConversationRow,
} from '@/features/chat/conversation-list';
import { createSocketClient } from '@/realtime/socket-client';
import { createTenantContext } from '@/tenant/tenant-context';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import { tokens } from '@/theme/tokens';

/**
 * Six avatar tints. A conversation without a photo still needs to be findable by shape and colour
 * when scanning a long list, which a single grey circle does not give you.
 */
const AVATAR_TINTS = [
  { background: '#E8F2FC', text: '#1268C4' },
  { background: '#E5F5EE', text: '#147A57' },
  { background: '#FFF3D9', text: '#A56308' },
  { background: '#FDECEF', text: '#C23E4D' },
  { background: '#EAF0FF', text: '#285CC4' },
  { background: '#E5F7FD', text: '#0E7C9B' },
] as const;

const ConversationItem = ({
  row,
  testID,
  onPress,
}: {
  row: ConversationRow;
  testID: string;
  onPress: () => void;
}) => {
  const tint = AVATAR_TINTS[row.avatarIndex % AVATAR_TINTS.length] ?? AVATAR_TINTS[0];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        row.unreadCount
          ? `${row.name}, ${row.unreadCount} tin nhắn chưa đọc. ${row.preview}`
          : `${row.name}. ${row.preview}`
      }
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.avatar, { backgroundColor: tint.background }]}>
        <Text style={[styles.avatarText, { color: tint.text }]}>{row.initials}</Text>
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text numberOfLines={1} style={styles.rowName}>
            {row.isGroup ? '# ' : ''}
            {row.name}
          </Text>
          <Text style={styles.rowTime}>{row.timeLabel}</Text>
        </View>

        <View style={styles.rowBottom}>
          <Text
            numberOfLines={1}
            style={[styles.rowPreview, row.unreadCount > 0 && styles.rowPreviewUnread]}
          >
            {row.preview}
          </Text>
          {row.unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {row.unreadCount > 99 ? '99+' : row.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

export default function ChatScreen() {
  const router = useRouter();
  const context = useTenantContextStore((state) => state.context);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!context) return;
    try {
      const client = await getAuthenticatedClient();
      const channels = (await listChannels(client, context.tenantId)) as Conversation[];
      setConversations(Array.isArray(channels) ? channels : []);
      setError(undefined);
    } catch {
      setError('Không tải được danh sách trò chuyện.');
    } finally {
      setLoaded(true);
    }
  }, [context]);

  useEffect(() => {
    void load();
  }, [load]);

  // A conversation list is only correct while it keeps up. Any incoming message reorders the list
  // and moves an unread count, so the socket refreshes it rather than the user pulling to refresh.
  useEffect(() => {
    if (!context) return;
    const socket = createSocketClient({
      baseUrl: getRuntimeConfig().apiBaseUrl,
      getAccessToken: getSessionAccessToken,
      context: createTenantContext(context),
    });
    socket.connect();
    const stop = socket.on('message:created', () => {
      void load();
    });
    return () => stop();
  }, [context, load]);

  const rows = useMemo(() => {
    const viewerMembershipId = context?.membershipId;
    return conversations
      .map((conversation) => toConversationRow(conversation, { viewerMembershipId }))
      .filter((row) => matchesQuery(row, query));
  }, [conversations, context?.membershipId, query]);

  const totalUnread = rows.reduce((sum, row) => sum + row.unreadCount, 0);

  return (
    <View testID="chat.screen" style={styles.screen}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.headerTitle}>
          Trò chuyện
        </Text>
        {totalUnread > 0 ? (
          <View
            testID="chat.badge-strip"
            accessibilityLabel={`${totalUnread} tin nhắn chưa đọc`}
            style={styles.headerBadge}
          >
            <Text style={styles.headerBadgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
          </View>
        ) : (
          <View
            testID="chat.badge-strip"
            accessibilityLabel="Không có tin nhắn chưa đọc"
            style={styles.headerBadgeEmpty}
          >
            <Text style={styles.headerBadgeEmptyText}>Đã đọc hết</Text>
          </View>
        )}
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          testID="chat.search"
          accessibilityLabel="Tìm kiếm trò chuyện"
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm kiếm"
          placeholderTextColor={tokens.color.muted}
          style={styles.search}
        />
      </View>

      <ScrollView
        testID="chat.conversation-list"
        accessibilityLabel="Danh sách trò chuyện"
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      >
        {rows.length ? (
          rows.map((row, index) => (
            <ConversationItem
              key={row.id}
              row={row}
              // Seeded channel ids change per run, so the first row carries a positional testID that
              // an E2E test can rely on. Every row also keeps its id-based one.
              testID={index === 0 ? 'chat.conversation-list.first' : `chat.conversation.${row.id}`}
              onPress={() => router.push(`/chat/${row.id}`)}
            />
          ))
        ) : (
          <Text style={styles.empty}>
            {!loaded
              ? 'Đang tải...'
              : query.trim()
                ? 'Không tìm thấy cuộc trò chuyện nào.'
                : 'Chưa có cuộc trò chuyện nào.'}
          </Text>
        )}
      </ScrollView>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.xxl + tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
  },
  headerTitle: { color: tokens.color.ink, fontSize: tokens.typography.title, fontWeight: '800' },
  headerBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    backgroundColor: tokens.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    color: tokens.color.inkInverted,
    fontSize: tokens.typography.label,
    fontWeight: '800',
  },
  headerBadgeEmpty: {
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.color.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeEmptyText: {
    color: tokens.color.success,
    fontSize: tokens.typography.label,
    fontWeight: '700',
  },
  searchWrap: { paddingHorizontal: tokens.spacing.lg, paddingBottom: tokens.spacing.md },
  search: {
    height: tokens.touchTarget,
    borderRadius: tokens.touchTarget / 2,
    paddingHorizontal: tokens.spacing.lg,
    backgroundColor: tokens.color.surfaceMuted,
    color: tokens.color.ink,
    fontSize: tokens.typography.body,
  },
  listContent: { paddingBottom: tokens.spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    paddingVertical: 10,
    paddingHorizontal: tokens.spacing.lg,
    minHeight: 68,
  },
  rowPressed: { backgroundColor: tokens.color.surfaceMuted },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: tokens.typography.body, fontWeight: '800' },
  rowBody: { flex: 1, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  rowName: {
    flex: 1,
    color: tokens.color.ink,
    fontSize: tokens.typography.body,
    fontWeight: '700',
  },
  rowTime: { color: tokens.color.muted, fontSize: tokens.typography.label },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  rowPreview: { flex: 1, color: tokens.color.muted, fontSize: tokens.typography.bodySmall },
  rowPreviewUnread: { color: tokens.color.ink },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: tokens.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: tokens.color.inkInverted,
    fontSize: tokens.typography.label,
    fontWeight: '800',
  },
  empty: {
    color: tokens.color.muted,
    fontSize: tokens.typography.body,
    padding: tokens.spacing.lg,
  },
  error: {
    color: tokens.color.danger,
    fontSize: tokens.typography.bodySmall,
    padding: tokens.spacing.lg,
  },
});
