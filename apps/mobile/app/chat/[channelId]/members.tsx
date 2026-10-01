import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenFrame } from '@/components/ui/ScreenPrimitives';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import {
  listChannelMembers,
  startDirectMessage,
  type ChannelMember,
} from '@/features/chat/chat-queries';
import { initialsFor } from '@/features/chat/conversation-list';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import { tokens } from '@/theme/tokens';

export default function ChannelMembersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ channelId: string }>();
  const channelId = String(params.channelId ?? '');
  const context = useTenantContextStore((state) => state.context);
  const [members, setMembers] = useState<ChannelMember[]>();
  const [openingId, setOpeningId] = useState<string>();
  const [error, setError] = useState<string>();

  const tenantId = context?.tenantId;

  useEffect(() => {
    let active = true;
    if (!tenantId || !channelId) return;
    void getAuthenticatedClient()
      .then((client) => listChannelMembers(client, tenantId, channelId))
      .then((items) => {
        if (active) setMembers(items);
      })
      .catch(() => {
        if (active) {
          setMembers([]);
          setError('Không tải được danh sách thành viên.');
        }
      });
    return () => {
      active = false;
    };
  }, [tenantId, channelId]);

  const openDirect = async (member: ChannelMember) => {
    if (!tenantId || openingId) return;
    setOpeningId(member.membershipId);
    setError(undefined);
    try {
      const client = await getAuthenticatedClient();
      // The backend returns the existing channel when the pair already has a DM.
      const channel = await startDirectMessage(client, tenantId, member.membershipId);
      router.replace(`/chat/${channel.id}`);
    } catch {
      setError(`Không mở được cuộc trò chuyện với ${member.displayName}. Hãy thử lại.`);
    } finally {
      setOpeningId(undefined);
    }
  };

  return (
    <ScreenFrame
      testID="chat.members.screen"
      eyebrow="ADSUP / CHAT"
      title="Thành viên"
      subtitle="Chọn một thành viên để nhắn tin riêng."
    >
      {members === undefined ? (
        <View style={styles.stateRow}>
          <ActivityIndicator testID="chat.members.loading" color={tokens.color.primary} />
          <Text style={styles.stateText}>Đang tải thành viên...</Text>
        </View>
      ) : members.length === 0 ? (
        <Text style={styles.stateText}>{error ?? 'Nhóm chưa có thành viên nào.'}</Text>
      ) : (
        <View style={styles.memberList}>
          {members.map((member) => {
            const isSelf = member.membershipId === context?.membershipId;
            return (
              <View key={member.membershipId} testID="chat.members.row" style={styles.memberRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initialsFor(member.displayName)}</Text>
                </View>
                <Text style={styles.memberName}>
                  {member.displayName}
                  {isSelf ? ' (Bạn)' : ''}
                </Text>
                {isSelf ? null : (
                  <Pressable
                    testID="chat.members.dm"
                    accessibilityRole="button"
                    accessibilityLabel={`Nhắn tin riêng với ${member.displayName}`}
                    accessibilityState={{ disabled: openingId === member.membershipId }}
                    disabled={openingId === member.membershipId}
                    onPress={() => void openDirect(member)}
                    style={({ pressed }) => [styles.dmButton, pressed && styles.dmPressed]}
                  >
                    <Text style={styles.dmText}>
                      {openingId === member.membershipId ? 'Đang mở...' : 'Nhắn riêng'}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
      {error && members && members.length > 0 ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
  stateText: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
  memberList: { gap: tokens.spacing.sm },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    minHeight: tokens.touchTarget,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.color.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: tokens.color.primary,
    fontSize: tokens.typography.label,
    fontWeight: '800',
  },
  memberName: {
    flex: 1,
    color: tokens.color.ink,
    fontSize: tokens.typography.body,
    fontWeight: '600',
  },
  dmButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: tokens.color.primarySoft,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
  },
  dmPressed: { opacity: 0.82 },
  dmText: { color: tokens.color.primary, fontSize: tokens.typography.label, fontWeight: '800' },
  error: { color: tokens.color.danger, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
});
