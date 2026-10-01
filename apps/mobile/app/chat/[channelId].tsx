import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
} from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { File } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { getRuntimeConfig } from '@/config/runtime-config';
import { getAuthenticatedClient, getSessionAccessToken } from '@/features/auth/session-runtime';
import { validateMessage } from '@/features/chat/chat-composer';
import {
  listChannels,
  listMessages,
  markChannelRead,
  sendMessage,
} from '@/features/chat/chat-queries';
import {
  formatDuration,
  getMediaDownloadUrl,
  uploadChatMedia,
  type ChatMediaUpload,
} from '@/features/chat/chat-media';
import { initialsFor, timeLabelFor, type Conversation } from '@/features/chat/conversation-list';
import { createSocketClient } from '@/realtime/socket-client';
import { createTenantContext } from '@/tenant/tenant-context';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import { tokens } from '@/theme/tokens';

type ChatMessageMedia = {
  mediaId: string;
  contentType: string;
  byteSize: number;
  durationMs?: number | null;
};

type ChatMessage = {
  id: string;
  body?: string;
  messageType?: string;
  media?: ChatMessageMedia | null;
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

const GALLERY_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'] as const;

const resolveGalleryContentType = (mimeType?: string | null): ChatMediaUpload['contentType'] => {
  if (mimeType && (GALLERY_CONTENT_TYPES as readonly string[]).includes(mimeType))
    return mimeType as ChatMediaUpload['contentType'];
  return mimeType?.startsWith('video/') ? 'video/mp4' : 'image/jpeg';
};

const formatByteSize = (byteSize: number): string => {
  if (byteSize >= 1_048_576) return `${(byteSize / 1_048_576).toFixed(1)} MB`;
  if (byteSize >= 1024) return `${Math.max(1, Math.round(byteSize / 1024))} KB`;
  return `${byteSize} B`;
};

const copyPickedMediaToCache = async (uri: string, mimeType: string): Promise<string> => {
  const base = LegacyFileSystem.cacheDirectory;
  if (!base) throw new Error('CACHE_UNAVAILABLE');
  const extension = mimeType.includes('video') ? 'mp4' : mimeType.includes('png') ? 'png' : 'jpg';
  const target = `${base}chat-media-${Date.now()}.${extension}`;
  await LegacyFileSystem.copyAsync({ from: uri, to: target });
  return target;
};

/**
 * Download urls are signed and short-lived; caching them per mediaId keeps a scrolled-back
 * conversation from re-signing the same attachment on every re-render.
 */
const downloadUrlCache = new Map<string, string>();

const useSignedMediaUrl = (mediaId: string | undefined): string | undefined => {
  const context = useTenantContextStore((state) => state.context);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!mediaId || !context) return;
    const cached = downloadUrlCache.get(mediaId);
    if (cached) {
      setUrl(cached);
      return;
    }
    let active = true;
    void getAuthenticatedClient()
      .then((client) => getMediaDownloadUrl(client, context.tenantId, mediaId))
      .then((result) => {
        downloadUrlCache.set(mediaId, result.url);
        if (active) setUrl(result.url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [mediaId, context]);
  return url;
};

const ImageBubble = ({ mediaId }: { mediaId: string }) => {
  const url = useSignedMediaUrl(mediaId);
  if (!url) return <Text style={styles.mediaPending}>Đang tải ảnh...</Text>;
  return <Image source={{ uri: url }} style={styles.mediaImage} resizeMode="cover" />;
};

const VideoBubble = ({ mediaId }: { mediaId: string }) => {
  const url = useSignedMediaUrl(mediaId);
  if (!url) return <Text style={styles.mediaPending}>Đang tải video...</Text>;
  return <VideoReadyBubble uri={url} />;
};

const VideoReadyBubble = ({ uri }: { uri: string }) => {
  const player = useVideoPlayer({ uri });
  return <VideoView player={player} style={styles.mediaVideo} />;
};

const VoiceBubble = ({ mediaId, durationMs }: { mediaId: string; durationMs?: number | null }) => {
  const url = useSignedMediaUrl(mediaId);
  if (!url) return <Text style={styles.mediaPending}>Đang tải tin nhắn thoại...</Text>;
  return <VoiceReadyBubble uri={url} durationMs={durationMs} />;
};

const VoiceReadyBubble = ({ uri, durationMs }: { uri: string; durationMs?: number | null }) => {
  const player = useAudioPlayer({ uri });
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) setPlaying(false);
    });
    return () => subscription.remove();
  }, [player]);
  const toggle = () => {
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.play();
      setPlaying(true);
    }
  };
  return (
    <View style={styles.voiceRow}>
      <Pressable
        testID="chat.voice.toggle"
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Tạm dừng tin nhắn thoại' : 'Phát tin nhắn thoại'}
        onPress={toggle}
        style={({ pressed }) => [styles.voiceButton, pressed && styles.mediaPressed]}
      >
        <Text style={styles.voiceGlyph}>{playing ? '❚❚' : '▶'}</Text>
      </Pressable>
      <Text style={styles.voiceDuration}>{formatDuration(durationMs)}</Text>
    </View>
  );
};

const FileBubble = ({ mediaId, byteSize }: { mediaId: string; byteSize: number }) => {
  const url = useSignedMediaUrl(mediaId);
  const open = () => {
    if (url) void Linking.openURL(url);
  };
  return (
    <Pressable
      testID="chat.file.download"
      accessibilityRole="button"
      accessibilityLabel={`Tải tệp đính kèm, dung lượng ${formatByteSize(byteSize)}`}
      onPress={open}
      style={({ pressed }) => [styles.fileRow, pressed && styles.mediaPressed]}
    >
      <Text style={styles.fileText}>📎 Tệp đính kèm · {formatByteSize(byteSize)}</Text>
    </Pressable>
  );
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordSecondsRef = useRef(0);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

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

  useEffect(
    () => () => {
      if (recordTimer.current) clearInterval(recordTimer.current);
    },
    [],
  );

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

  const sendMedia = useCallback(
    async (media: ChatMediaUpload) => {
      if (!context || !channelId || uploading) return;
      setUploading(true);
      setUploadProgress(0);
      try {
        const client = await getAuthenticatedClient();
        const stamp = Date.now();
        const { mediaId } = await uploadChatMedia(client, context.tenantId, media, {
          idempotencyKey: `chat-media-${stamp}`,
          onProgress: setUploadProgress,
        });
        const created = (await sendMessage(client, context.tenantId, channelId, {
          clientMessageId: `mobile-${stamp}`,
          body: draft.trim(),
          mediaId,
          idempotencyKey: `chat-${stamp}`,
        })) as ChatMessage;
        setMessages((current) => mergeMessages(current, [created]));
        setDraft('');
        setError(undefined);
      } catch {
        setError('Chưa gửi được media. Thử lại nhé.');
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [context, channelId, draft, uploading],
  );

  const pickMedia = useCallback(async () => {
    setMenuOpen(false);
    if (!context) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      // The photo picker can hand back a content:// URI which the File API and XHR body streaming
      // cannot read; copy it into cache so the upload always works from a real file path.
      const uri = asset.uri.startsWith('file://')
        ? asset.uri
        : await copyPickedMediaToCache(asset.uri, asset.mimeType ?? 'media');
      const file = new File(uri);
      await sendMedia({
        uri,
        contentType: resolveGalleryContentType(asset.mimeType),
        // The picker re-encodes with quality < 1, so the cache file's real size is what gets PUT;
        // asset.fileSize is the original's and would fail the server's size validation.
        byteSize: file.size || asset.fileSize || 0,
        durationMs: asset.duration ? Math.round(asset.duration * 1000) : undefined,
      });
    } catch {
      setError('Chưa gửi được media. Thử lại nhé.');
    }
  }, [context, sendMedia]);

  const startRecording = useCallback(async () => {
    setMenuOpen(false);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Cần quyền micrô để ghi âm.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordSecondsRef.current = 0;
      setRecordSeconds(0);
      setRecording(true);
      recordTimer.current = setInterval(() => {
        recordSecondsRef.current += 1;
        setRecordSeconds(recordSecondsRef.current);
      }, 1000);
    } catch {
      setError('Không bắt đầu ghi âm được. Thử lại nhé.');
    }
  }, [recorder]);

  const finishRecording = useCallback(
    async (send: boolean) => {
      if (recordTimer.current) {
        clearInterval(recordTimer.current);
        recordTimer.current = null;
      }
      setRecording(false);
      try {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        const uri = recorder.uri;
        if (!send || !uri) return;
        const file = new File(uri);
        await sendMedia({
          uri,
          contentType: 'audio/mp4',
          byteSize: file.size,
          durationMs: Math.max(1000, recordSecondsRef.current * 1000),
        });
      } catch {
        setError('Chưa gửi được bản ghi âm. Thử lại nhé.');
      }
    },
    [recorder, sendMedia],
  );

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
          isMedia:
            Boolean(item.media) &&
            item.messageType !== 'TEXT' &&
            item.messageType !== 'SYSTEM' &&
            Boolean(item.messageType),
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
        <Pressable
          testID="chat.members"
          accessibilityRole="button"
          accessibilityLabel="Xem thành viên"
          onPress={() => router.push(`/chat/${channelId}/members`)}
          style={({ pressed }) => [styles.membersButton, pressed && styles.membersPressed]}
        >
          <Text style={styles.membersText}>Thành viên</Text>
        </Pressable>
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
          decorated.map(({ item, isOwn, startsRun, endsRun, isMedia }) => (
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
                  isMedia && styles.bubbleMedia,
                ]}
              >
                {!isOwn && startsRun ? (
                  <Text style={styles.author}>{item.authorDisplayName ?? 'Thành viên'}</Text>
                ) : null}
                {isMedia && item.media ? (
                  <View style={styles.mediaWrap}>
                    {item.messageType === 'IMAGE' ? <ImageBubble mediaId={item.media.mediaId} /> : null}
                    {item.messageType === 'VIDEO' ? <VideoBubble mediaId={item.media.mediaId} /> : null}
                    {item.messageType === 'AUDIO' ? (
                      <VoiceBubble mediaId={item.media.mediaId} durationMs={item.media.durationMs} />
                    ) : null}
                    {item.messageType === 'FILE' ? (
                      <FileBubble mediaId={item.media.mediaId} byteSize={item.media.byteSize} />
                    ) : null}
                    {item.body ? (
                      <Text style={[styles.body, isOwn && styles.bodyOwn, styles.caption]}>
                        {item.body}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={[styles.body, isOwn && styles.bodyOwn]}>{item.body}</Text>
                )}
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

      {uploading ? (
        <Text testID="chat.upload-progress" style={styles.uploading}>
          Đang gửi media... {uploadProgress}%
        </Text>
      ) : null}

      {recording ? (
        <View testID="chat.recording" style={styles.recordingRow}>
          <Text style={styles.recordingText}>● Đang ghi âm {recordSeconds}s</Text>
          <Pressable
            testID="chat.record.cancel"
            accessibilityRole="button"
            accessibilityLabel="Huỷ ghi âm"
            onPress={() => void finishRecording(false)}
            style={({ pressed }) => [styles.recordCancelButton, pressed && styles.mediaPressed]}
          >
            <Text style={styles.recordCancelText}>Huỷ</Text>
          </Pressable>
          <Pressable
            testID="chat.record.stop"
            accessibilityRole="button"
            accessibilityLabel="Dừng và gửi bản ghi âm"
            onPress={() => void finishRecording(true)}
            style={({ pressed }) => [styles.recordSendButton, pressed && styles.mediaPressed]}
          >
            <Text style={styles.recordSendText}>Dừng và gửi</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {menuOpen ? (
            <View testID="chat.attach-menu" style={styles.attachMenu}>
              <Pressable
                testID="chat.attach.gallery"
                accessibilityRole="button"
                accessibilityLabel="Gửi ảnh hoặc video"
                onPress={() => void pickMedia()}
                style={({ pressed }) => [styles.attachOption, pressed && styles.mediaPressed]}
              >
                <Text style={styles.attachText}>🖼 Ảnh / Video</Text>
              </Pressable>
              <Pressable
                testID="chat.attach.record"
                accessibilityRole="button"
                accessibilityLabel="Ghi âm tin nhắn"
                onPress={() => void startRecording()}
                style={({ pressed }) => [styles.attachOption, pressed && styles.mediaPressed]}
              >
                <Text style={styles.attachText}>🎤 Ghi âm</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.composer}>
            <Pressable
              testID="chat.attach"
              accessibilityRole="button"
              accessibilityLabel="Gửi media"
              accessibilityState={{ expanded: menuOpen }}
              onPress={() => setMenuOpen((open) => !open)}
              style={({ pressed }) => [styles.attachButton, pressed && styles.mediaPressed]}
            >
              <Text style={styles.attachGlyph}>＋</Text>
            </Pressable>
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
        </>
      )}
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
  membersButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: tokens.color.primarySoft,
    paddingHorizontal: tokens.spacing.md,
  },
  membersPressed: { opacity: 0.82 },
  membersText: { color: tokens.color.primary, fontSize: tokens.typography.label, fontWeight: '800' },

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
  bubbleMedia: { paddingHorizontal: tokens.spacing.sm },
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
  caption: { marginTop: tokens.spacing.xs },
  mediaWrap: { gap: tokens.spacing.xs },
  mediaPending: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall },
  mediaPressed: { opacity: 0.82 },
  mediaImage: { width: 220, height: 200, borderRadius: 12 },
  mediaVideo: { width: 220, height: 200, borderRadius: 12, backgroundColor: tokens.color.canvas },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.color.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceGlyph: { color: tokens.color.primary, fontSize: 15, fontWeight: '800' },
  voiceDuration: { color: tokens.color.ink, fontSize: tokens.typography.bodySmall, fontWeight: '700' },
  fileRow: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: 12,
    backgroundColor: tokens.color.primarySoft,
  },
  fileText: { color: tokens.color.primary, fontSize: tokens.typography.bodySmall, fontWeight: '700' },
  time: { color: tokens.color.muted, fontSize: 11, alignSelf: 'flex-end', marginTop: 2 },
  timeOwn: { color: tokens.color.primaryMuted },
  empty: { color: tokens.color.muted, fontSize: tokens.typography.body, padding: tokens.spacing.lg },

  error: {
    color: tokens.color.danger,
    fontSize: tokens.typography.bodySmall,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.sm,
  },
  uploading: {
    color: tokens.color.muted,
    fontSize: tokens.typography.bodySmall,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xs,
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    backgroundColor: tokens.color.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
  },
  recordingText: { flex: 1, color: tokens.color.danger, fontSize: tokens.typography.bodySmall, fontWeight: '700' },
  recordCancelButton: {
    minHeight: tokens.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.touchTarget / 2,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  recordCancelText: { color: tokens.color.muted, fontWeight: '700' },
  recordSendButton: {
    minHeight: tokens.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.touchTarget / 2,
    backgroundColor: tokens.color.primary,
  },
  recordSendText: { color: tokens.color.inkInverted, fontWeight: '800' },
  attachMenu: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
    gap: tokens.spacing.xs,
    backgroundColor: tokens.color.surface,
  },
  attachOption: {
    minHeight: tokens.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surfaceMuted,
  },
  attachText: { color: tokens.color.ink, fontSize: tokens.typography.body },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    backgroundColor: tokens.color.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
  },
  attachButton: {
    width: tokens.touchTarget,
    height: tokens.touchTarget,
    borderRadius: tokens.touchTarget / 2,
    backgroundColor: tokens.color.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachGlyph: { color: tokens.color.primary, fontSize: 24, fontWeight: '800', marginTop: -2 },
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
