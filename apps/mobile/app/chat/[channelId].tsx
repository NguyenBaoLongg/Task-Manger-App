import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getRuntimeConfig } from '@/config/runtime-config';
import { getAuthenticatedClient, getSessionAccessToken } from '@/features/auth/session-runtime';
import { validateMessage } from '@/features/chat/chat-composer';
import {
  listChannels,
  listMessages,
  markChannelRead,
  sendMessage,
} from '@/features/chat/chat-queries';
import { initialsFor, timeLabelFor, type Conversation } from '@/features/chat/conversation-list';
import { createSocketClient } from '@/realtime/socket-client';
import { createTenantContext } from '@/tenant/tenant-context';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import { tokens } from '@/theme/tokens';

type ChatMessage = {
  id: string;
  body?: string;
  createdAt?: string;
  authorMembershipId?: string;
  authorDisplayName?: string;
};

type MessagePage = { items?: ChatMessage[]; nextCursor?: string };

/**
 * The API returns newest first because that is what a cursor over `createdAt desc` gives. A
 * conversation reads oldest at the top, so the merged set is sorted once here rather than each
 * caller remembering to.
 */
const mergeMessages = (current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] => {
  const seen = new Set(current.map((item) => item.id));
  const merged = [...current, ...incoming.filter((item) => item.id && !seen.has(item.id))];
  return merged.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
};

const clockLabel = (iso?: string): string => {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
};

export default function ConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ channelId: string }>();
  const channelId = String(params.channelId ?? '');
  const context = useTenantContextStore((state) => state.context);

  const [channel, setChannel] = useState<Conversation>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string>();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!context || !channelId) return;
    let active = true;

    void (async () => {
      try {
        const client = await getAuthenticatedClient();
        const channels = (await listChannels(client, context.tenantId)) as Conversation[];
        const found = Array.isArray(channels)
          ? channels.find((item) => item.id === channelId)
          : undefined;
        if (active) setChannel(found);

        const page = (await listMessages(client, context.tenantId, channelId)) as MessagePage;
        if (!active) return;
        setMessages(mergeMessages([], page.items ?? []));
        setNextCursor(page.nextCursor);

        // Opening a conversation is what marks it read; the badge must not survive the visit.
        await markChannelRead(client, context.tenantId, channelId);
      } catch {
        if (active) setError('Không tải được cuộc trò chuyện.');
      }
    })();

    return () => {
      active = false;
    };
  }, [context, channelId]);

  useEffect(() => {
    if (!context || !channelId) return;
    const socket = createSocketClient({
      baseUrl: getRuntimeConfig().apiBaseUrl,
      getAccessToken: getSessionAccessToken,
      context: createTenantContext(context),
    });
    socket.connect();
    // The server publishes `message:created` to the channel room only; without joining it this
    // socket would never receive it, so sent messages would never appear in the thread.
    void socket.joinChannel(channelId);
    const stop = socket.on('message:created', (payload) => {
      const item = payload as ChatMessage & { channelId?: string };
      if (!item.id || (item.channelId && item.channelId !== channelId)) return;
      setMessages((current) => mergeMessages(current, [item]));
    });
    return () => {
      stop();
      socket.leaveChannel(channelId);
      socket.disconnect();
    };
  }, [context, channelId]);

  const loadOlder = useCallback(async () => {
    if (!context || !nextCursor) return;
    const client = await getAuthenticatedClient();
    const page = (await listMessages(
      client,
      context.tenantId,
      channelId,
      nextCursor,
    )) as MessagePage;
    setMessages((current) => mergeMessages(current, page.items ?? []));
    setNextCursor(page.nextCursor);
  }, [context, channelId, nextCursor]);

  const submit = useCallback(async () => {
    if (!context || !channelId) return;
    try {
      const body = validateMessage(draft);
      const client = await getAuthenticatedClient();
      const stamp = Date.now();
      const created = (await sendMessage(client, context.tenantId, channelId, {
        clientMessageId: `mobile-${stamp}`,
        body,
        idempotencyKey: `chat-${stamp}`,
      })) as ChatMessage;
      // The socket event may lag or drop; the sent message must show immediately.
      setMessages((current) => mergeMessages(current, [created]));
      setDraft('');
      setError(undefined);
    } catch {
      setError('Chưa gửi được tin nhắn. Kiểm tra nội dung rồi thử lại.');
    }
  }, [context, channelId, draft]);

  const title = channel?.name ?? 'Trò chuyện';

  /**
   * Consecutive messages from one author collapse into a run: only the first shows the author, and
   * only the last carries the timestamp. Without this a group conversation repeats the same name on
   * every line and becomes unreadable.
   */
  const decorated = useMemo(
    () =>
      messages.map((item, index) => {
        const previous = messages[index - 1];
        const next = messages[index + 1];
        return {
          item,
          isOwn: Boolean(context) && item.authorMembershipId === context?.membershipId,
          startsRun: previous?.authorMembershipId !== item.authorMembershipId,
          endsRun: next?.authorMembershipId !== item.authorMembershipId,
        };
      }),
    [messages, context],
  );

  return (
    <View testID="chat.conversation" style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          testID="chat.back"
          accessibilityRole="button"
          accessibilityLabel="Quay lại danh sách trò chuyện"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{initialsFor(title)}</Text>
        </View>
        <View style={styles.headerBody}>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {title}
          </Text>
          <Text style={styles.headerMeta}>
            {messages.length} tin nhắn
            {channel?.lastActivityAt
              ? ` · ${timeLabelFor(channel.lastActivityAt, new Date())}`
              : ''}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        testID="chat.message-list"
        accessibilityLabel="Tin nhắn"
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      >
        {nextCursor ? (
          <Pressable testID="chat.load-older" onPress={() => void loadOlder()} style={styles.older}>
            <Text style={styles.olderText}>Xem tin nhắn cũ hơn</Text>
          </Pressable>
        ) : null}

        {decorated.length ? (
          decorated.map(({ item, isOwn, startsRun, endsRun }) => (
            <View
              key={item.id}
              style={[
                styles.bubbleRow,
                isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther,
                endsRun ? styles.bubbleRowRunEnd : styles.bubbleRowRunInner,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  isOwn ? styles.bubbleOwn : styles.bubbleOther,
                  startsRun && (isOwn ? styles.bubbleOwnFirst : styles.bubbleOtherFirst),
                ]}
              >
                {!isOwn && startsRun ? (
                  <Text style={styles.author}>{item.authorDisplayName ?? 'Thành viên'}</Text>
                ) : null}
                <Text style={[styles.body, isOwn && styles.bodyOwn]}>{item.body}</Text>
                {endsRun ? (
                  <Text style={[styles.time, isOwn && styles.timeOwn]}>
                    {clockLabel(item.createdAt)}
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện.</Text>
        )}
      </ScrollView>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          testID="chat.composer"
          accessibilityLabel="Soạn tin nhắn"
          value={draft}
          onChangeText={setDraft}
          placeholder="Nhắn tin..."
          placeholderTextColor={tokens.color.muted}
          multiline
          style={styles.input}
        />
        <Pressable
          testID="chat.send"
          accessibilityRole="button"
          accessibilityLabel="Gửi tin nhắn"
          accessibilityState={{ disabled: !draft.trim() }}
          disabled={!draft.trim()}
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.send,
            !draft.trim() && styles.sendDisabled,
            pressed && styles.sendPressed,
          ]}
        >
          <Text style={styles.sendText}>➤</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.xxl + tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
    backgroundColor: tokens.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  back: {
    width: tokens.touchTarget,
    height: tokens.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: tokens.color.primary, fontSize: 34, lineHeight: 36, fontWeight: '600' },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.color.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    color: tokens.color.primary,
    fontSize: tokens.typography.bodySmall,
    fontWeight: '800',
  },
  headerBody: { flex: 1 },
  headerTitle: { color: tokens.color.ink, fontSize: tokens.typography.heading, fontWeight: '800' },
  headerMeta: { color: tokens.color.muted, fontSize: tokens.typography.label, marginTop: 2 },

  listContent: { padding: tokens.spacing.md, gap: 2 },
  older: { alignSelf: 'center', padding: tokens.spacing.md },
  olderText: { color: tokens.color.primary, fontSize: tokens.typography.bodySmall, fontWeight: '700' },

  bubbleRow: { flexDirection: 'row' },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },
  bubbleRowRunEnd: { marginBottom: tokens.spacing.md },
  bubbleRowRunInner: { marginBottom: 2 },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: 18,
  },
  bubbleOwn: { backgroundColor: tokens.color.primary, borderBottomRightRadius: 6 },
  bubbleOther: {
    backgroundColor: tokens.color.surface,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  bubbleOwnFirst: { borderTopRightRadius: 18 },
  bubbleOtherFirst: { borderTopLeftRadius: 18 },
  author: {
    color: tokens.color.accent,
    fontSize: tokens.typography.label,
    fontWeight: '800',
    marginBottom: 2,
  },
  body: { color: tokens.color.ink, fontSize: tokens.typography.body, lineHeight: 21 },
  bodyOwn: { color: tokens.color.inkInverted },
  time: { color: tokens.color.muted, fontSize: 11, alignSelf: 'flex-end', marginTop: 2 },
  timeOwn: { color: tokens.color.primaryMuted },
  empty: { color: tokens.color.muted, fontSize: tokens.typography.body, padding: tokens.spacing.lg },

  error: {
    color: tokens.color.danger,
    fontSize: tokens.typography.bodySmall,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.sm,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    backgroundColor: tokens.color.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
  },
  input: {
    flex: 1,
    minHeight: tokens.touchTarget,
    maxHeight: 120,
    borderRadius: tokens.touchTarget / 2,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: tokens.color.surfaceMuted,
    color: tokens.color.ink,
    fontSize: tokens.typography.body,
  },
  send: {
    width: tokens.touchTarget,
    height: tokens.touchTarget,
    borderRadius: tokens.touchTarget / 2,
    backgroundColor: tokens.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: tokens.color.primaryMuted },
  sendPressed: { backgroundColor: tokens.color.primaryPressed },
  sendText: { color: tokens.color.inkInverted, fontSize: 18, fontWeight: '800' },
});
