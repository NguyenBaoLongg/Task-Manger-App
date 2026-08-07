import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton, ScreenFrame, StatusPill, Surface } from '@/components/ui/ScreenPrimitives';
import { getRuntimeConfig } from '@/config/runtime-config';
import { getAuthenticatedClient, getSessionAccessToken } from '@/features/auth/session-runtime';
import { validateMessage } from '@/features/chat/chat-composer';
import { listChannels, listMessages, sendMessage } from '@/features/chat/chat-queries';
import { createBadgeStore, unreadByKind, type Badge } from '@/notifications/badge-store';
import { createSocketClient } from '@/realtime/socket-client';
import { createTenantContext } from '@/tenant/tenant-context';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import { tokens } from '@/theme/tokens';

type ChatMessage = { id: string; body?: string; createdAt?: string };
type MessagePage = { items?: ChatMessage[]; nextCursor?: string; unreadCount?: number };

const mergeMessages = (current: ChatMessage[], incoming: ChatMessage[]) => {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !seen.has(item.id))];
};

export default function ChatScreen() {
  const [message, setMessage] = useState('');
  const [channelId, setChannelId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [error, setError] = useState<string>();
  const badgeStore = useMemo(() => createBadgeStore(), []);
  const context = useTenantContextStore((state) => state.context);

  const refreshBadges = () => setBadges(badgeStore.snapshot());

  useEffect(() => {
    if (!context) return;
    const scopedContext = createTenantContext(context);
    let active = true;
    let stop: () => void = () => undefined;
    void getAuthenticatedClient()
      .then((client) =>
        listChannels(client, context.tenantId).then((channels) => {
          const first = Array.isArray(channels)
            ? (channels[0] as { id?: string } | undefined)
            : undefined;
          if (!first?.id) return undefined;
          setChannelId(first.id);
          return listMessages(client, context.tenantId, first.id);
        }),
      )
      .then((page) => {
        const value = page as MessagePage | undefined;
        if (active) {
          setMessages(value?.items ?? []);
          setNextCursor(value?.nextCursor);
          for (let index = 0; index < (value?.unreadCount ?? 0); index += 1)
            badgeStore.add({ effectKey: `chat-page-${index}`, kind: 'CHAT' });
          refreshBadges();
        }
        const socket = createSocketClient({
          baseUrl: getRuntimeConfig().apiBaseUrl,
          getAccessToken: getSessionAccessToken,
          context: scopedContext,
        });
        socket.connect();
        stop = socket.on('message:created', (payload) => {
          const item = payload as ChatMessage;
          if (!item.id) return;
          badgeStore.add({ effectKey: `chat-${item.id}`, kind: 'CHAT' });
          refreshBadges();
          setMessages((current) => mergeMessages(current, [item]));
        });
      })
      .catch(() => {
        if (active) setError('Could not load chat channels.');
      });
    return () => {
      active = false;
      stop();
    };
  }, [context, badgeStore]);

  const loadMore = async () => {
    if (!context || !channelId || !nextCursor) return;
    const client = await getAuthenticatedClient();
    const page = (await listMessages(
      client,
      context.tenantId,
      channelId,
      nextCursor,
    )) as MessagePage;
    setMessages((current) => mergeMessages(current, page.items ?? []));
    setNextCursor(page.nextCursor);
  };

  const submit = async () => {
    if (!context || !channelId) return;
    try {
      const body = validateMessage(message);
      const client = await getAuthenticatedClient();
      await sendMessage(client, context.tenantId, channelId, {
        clientMessageId: `mobile-${Date.now()}`,
        body,
        idempotencyKey: `chat-${Date.now()}`,
      });
      setMessage('');
      setError(undefined);
    } catch {
      setError('Message was not sent. Check the content and try again.');
    }
  };

  const markRead = () => {
    for (const badge of badgeStore.snapshot()) badgeStore.markRead(badge.effectKey);
    refreshBadges();
  };

  const unreadCounts = unreadByKind(badges);

  return (
    <ScreenFrame
      testID="chat.screen"
      eyebrow="ADSUP / CHAT"
      title="Team chat"
      subtitle="Realtime tenant chat with unread badges."
    >
      <View style={styles.channelHeader}>
        <View>
          <Text style={styles.channelName}>General channel</Text>
          <Text style={styles.channelMeta}>{messages.length} recent messages</Text>
        </View>
        <StatusPill
          label={`${unreadCounts.CHAT ?? 0} unread`}
          tone={unreadCounts.CHAT ? 'warning' : 'success'}
        />
      </View>
      <View
        testID="chat.badge-strip"
        accessibilityLabel={'Th\u00f4ng b\u00e1o'}
        style={styles.notificationStrip}
      >
        <Text style={styles.notificationTitle}>Badge summary</Text>
        <Text style={styles.notificationBody}>Chat unread: {unreadCounts.CHAT ?? 0}</Text>
        <AppButton
          testID="chat.mark-read"
          label="Mark chat read"
          variant="quiet"
          onPress={markRead}
          disabled={!unreadCounts.CHAT}
        />
      </View>
      <Surface
        testID="chat.message-list"
        accessibilityLabel={'Tin nh\u1eafn'}
        style={styles.messageSurface}
      >
        {messages.length ? (
          messages.map((item, index) => (
            <View key={item.id} style={[styles.messageRow, index > 0 && styles.messageDivider]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>A</Text>
              </View>
              <View style={styles.messageBody}>
                <Text style={styles.sender}>Workspace member</Text>
                <Text style={styles.message}>{item.body}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>No messages yet.</Text>
        )}
        {nextCursor ? (
          <AppButton label="Load more" variant="secondary" onPress={() => void loadMore()} />
        ) : null}
      </Surface>
      <Surface style={styles.composer}>
        <TextInput
          accessibilityLabel="Compose message"
          testID="chat.composer"
          value={message}
          onChangeText={setMessage}
          placeholder="Write a message..."
          placeholderTextColor={tokens.color.muted}
          multiline
          style={styles.input}
        />
        <AppButton
          testID="chat.send"
          label="Send message"
          onPress={() => void submit()}
          disabled={!message.trim()}
        />
      </Surface>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  channelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  channelName: { color: tokens.color.ink, fontSize: tokens.typography.heading, fontWeight: '800' },
  channelMeta: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall, marginTop: 4 },
  notificationStrip: {
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.infoSoft,
    gap: 4,
  },
  notificationTitle: {
    color: tokens.color.info,
    fontSize: tokens.typography.bodySmall,
    fontWeight: '800',
  },
  notificationBody: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall },
  messageSurface: { gap: 14, minHeight: 180 },
  messageRow: { flexDirection: 'row', gap: tokens.spacing.md, paddingVertical: 4 },
  messageDivider: { borderTopWidth: 1, borderTopColor: tokens.color.border, paddingTop: 14 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.color.infoSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: tokens.color.info, fontWeight: '800' },
  messageBody: { flex: 1, gap: 4 },
  sender: { color: tokens.color.muted, fontSize: tokens.typography.label, fontWeight: '700' },
  message: { color: tokens.color.ink, fontSize: tokens.typography.body, lineHeight: 22 },
  empty: { color: tokens.color.muted, fontSize: tokens.typography.body, lineHeight: 22 },
  composer: { gap: tokens.spacing.md },
  input: {
    minHeight: 72,
    color: tokens.color.ink,
    fontSize: tokens.typography.body,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  error: { color: tokens.color.danger, fontSize: tokens.typography.bodySmall },
});
