import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppButton, ScreenFrame, SectionHeading } from '@/components/ui/ScreenPrimitives';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import {
  CreateGroupError,
  createGroup,
  freshGroupIdempotencyKey,
  listGroupCandidates,
  validateGroupName,
  type GroupMember,
} from '@/features/chat/create-group-model';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import { tokens } from '@/theme/tokens';

export default function CreateGroupScreen() {
  const router = useRouter();
  const context = useTenantContextStore((state) => state.context);
  const [name, setName] = useState('');
  const [members, setMembers] = useState<GroupMember[]>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [membersNote, setMembersNote] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  const idempotencyKeyRef = useRef<string | undefined>(undefined);

  const tenantId = context?.tenantId;

  useEffect(() => {
    let active = true;
    if (!tenantId || !context) return;
    setMembersNote(undefined);
    void getAuthenticatedClient()
      .then((client) => listGroupCandidates(client, tenantId, context.membershipId))
      .then((items) => {
        if (!active) return;
        setMembers(items);
      })
      .catch(() => {
        if (!active) return;
        // Without member.read the group is still creatable — the creator joins alone.
        setMembers([]);
        setMembersNote(
          'Không tải được danh sách thành viên. Bạn vẫn có thể tạo nhóm chỉ có mình bạn.',
        );
      });
    return () => {
      active = false;
    };
  }, [tenantId, context]);

  const toggleMember = (memberId: string) => {
    setSelectedIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );
  };

  const nameError = name.trim() ? validateGroupName(name) : undefined;
  const canCreate = Boolean(tenantId) && !nameError && name.trim().length > 0 && !creating;

  const submit = async () => {
    if (!tenantId || !canCreate) return;
    setCreating(true);
    setError(undefined);
    try {
      const client = await getAuthenticatedClient();
      const key = (idempotencyKeyRef.current ??= freshGroupIdempotencyKey());
      await createGroup(client, tenantId, {
        name,
        membershipIds: selectedIds,
        idempotencyKey: key,
      });
      idempotencyKeyRef.current = undefined;
      router.back();
    } catch (caught) {
      idempotencyKeyRef.current = undefined;
      setError(
        caught instanceof CreateGroupError ? caught.message : 'Không tạo được nhóm. Hãy thử lại.',
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScreenFrame
      testID="create-group.screen"
      eyebrow="ADSUP / CHAT"
      title="Tạo nhóm chat"
      subtitle="Đặt tên nhóm và chọn thành viên cùng tham gia."
    >
      <View style={styles.section}>
        <SectionHeading title="Tên nhóm" detail={`${name.trim().length}/120`} />
        <TextInput
          testID="create-group.name"
          accessibilityLabel="Tên nhóm"
          value={name}
          onChangeText={setName}
          placeholder="Ví dụ: Nhóm ca sáng"
          placeholderTextColor={tokens.color.muted}
          maxLength={120}
          style={styles.nameInput}
        />
        {nameError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {nameError}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <SectionHeading
          title="Chọn thành viên"
          detail={members ? `Đã chọn ${selectedIds.length}/${members.length}` : undefined}
        />
        {members === undefined ? (
          <View style={styles.stateRow}>
            <ActivityIndicator testID="create-group.loading" color={tokens.color.primary} />
            <Text style={styles.stateText}>Đang tải danh sách thành viên...</Text>
          </View>
        ) : members.length === 0 ? (
          <Text style={styles.stateText}>
            {membersNote ?? 'Không có thành viên nào khác trong công ty.'}
          </Text>
        ) : (
          <View style={styles.memberList}>
            {members.map((member) => {
              const selected = selectedIds.includes(member.id);
              return (
                <Pressable
                  key={member.id}
                  testID="create-group.member"
                  accessibilityRole="checkbox"
                  accessibilityLabel={member.displayName}
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggleMember(member.id)}
                  style={({ pressed }) => [
                    styles.memberRow,
                    selected && styles.memberRowSelected,
                    pressed && styles.memberRowPressed,
                  ]}
                >
                  <Text style={styles.memberName}>{member.displayName}</Text>
                  <Text style={[styles.memberCheck, selected && styles.memberCheckSelected]}>
                    {selected ? '●' : '○'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {membersNote && members && members.length > 0 ? (
          <Text style={styles.stateText}>{membersNote}</Text>
        ) : null}
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <AppButton
        testID="create-group.submit"
        label={creating ? 'Đang tạo...' : 'Tạo nhóm'}
        disabled={!canCreate}
        onPress={() => void submit()}
      />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  section: { gap: tokens.spacing.md },
  nameInput: {
    minHeight: tokens.touchTarget,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surfaceMuted,
    paddingHorizontal: tokens.spacing.lg,
    color: tokens.color.ink,
    fontSize: tokens.typography.body,
  },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
  stateText: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
  memberList: { gap: tokens.spacing.sm },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.md,
    minHeight: tokens.touchTarget,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
  },
  memberRowSelected: {
    borderColor: tokens.color.primary,
    backgroundColor: tokens.color.primarySoft,
  },
  memberRowPressed: { opacity: 0.82 },
  memberName: {
    flex: 1,
    color: tokens.color.ink,
    fontSize: tokens.typography.body,
    fontWeight: '600',
  },
  memberCheck: { color: tokens.color.muted, fontSize: 18 },
  memberCheckSelected: { color: tokens.color.primary },
  error: { color: tokens.color.danger, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
});
