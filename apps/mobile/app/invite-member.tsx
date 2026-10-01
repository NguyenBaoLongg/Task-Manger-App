import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { ApiProblemError } from '@/api/problem';
import { AppButton, ScreenFrame, SectionHeading, StatusPill, Surface } from '@/components/ui/ScreenPrimitives';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import {
  buildSharePayload,
  createInvitation,
  freshInvitationIdempotencyKey,
  listInviteRoles,
  type InvitationResult,
  type InviteRole,
} from '@/features/members/invite-model';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import { tokens } from '@/theme/tokens';

const formatExpiry = (expiresAt: string) =>
  new Date(expiresAt).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function InviteMemberScreen() {
  const context = useTenantContextStore((state) => state.context);
  const tenantId = context?.tenantId;
  const [roles, setRoles] = useState<InviteRole[]>();
  const [selectedRoleId, setSelectedRoleId] = useState<string>();
  const [invitation, setInvitation] = useState<InvitationResult>();
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  const idempotencyKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    if (!tenantId) {
      setLoadingRoles(false);
      setError('Chưa chọn workspace. Hãy quay lại tab Workspace và thử lại.');
      return;
    }
    setLoadingRoles(true);
    void getAuthenticatedClient()
      .then((client) => listInviteRoles(client, tenantId))
      .then((items) => {
        if (!active) return;
        setRoles(items);
        setError(undefined);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof ApiProblemError && caught.status === 403
            ? 'Bạn không có quyền xem vai trò. Hãy liên hệ quản trị viên công ty.'
            : 'Không tải được danh sách vai trò. Hãy kiểm tra mạng và thử lại.',
        );
      })
      .finally(() => {
        if (active) setLoadingRoles(false);
      });
    return () => {
      active = false;
    };
  }, [tenantId]);

  const selectRole = (role: InviteRole) => {
    setSelectedRoleId(role.id);
    setInvitation(undefined);
    setError(undefined);
    idempotencyKeyRef.current = undefined;
  };

  const create = async () => {
    if (!tenantId || !selectedRoleId) return;
    setCreating(true);
    setError(undefined);
    try {
      const client = await getAuthenticatedClient();
      const key = (idempotencyKeyRef.current ??= freshInvitationIdempotencyKey());
      const result = await createInvitation(client, tenantId, selectedRoleId, {
        idempotencyKey: key,
      });
      idempotencyKeyRef.current = undefined;
      setInvitation(result);
    } catch (caught) {
      setError(
        caught instanceof ApiProblemError
          ? caught.status === 403
            ? 'Bạn không có quyền tạo lời mời.'
            : caught.message
          : 'Không tạo được lời mời. Hãy kiểm tra mạng và thử lại.',
      );
    } finally {
      setCreating(false);
    }
  };

  const share = () => {
    if (!invitation) return;
    void Share.share({ message: buildSharePayload(invitation) });
  };

  const canCreate = Boolean(tenantId && selectedRoleId && !creating && !loadingRoles);

  return (
    <ScreenFrame
      testID="invite-member.screen"
      eyebrow="ADSUP / MEMBERS"
      title="Mời thành viên"
      subtitle="Chọn vai trò, tạo mã lời mời và gửi cho đồng nghiệp."
    >
      <View style={styles.section}>
        <SectionHeading title="Chọn vai trò" detail={roles ? `${roles.length} vai trò` : undefined} />
        {loadingRoles ? (
          <View style={styles.stateRow}>
            <ActivityIndicator
              testID="invite-member.loading"
              accessibilityLabel="Đang tải vai trò"
              color={tokens.color.primary}
            />
            <Text style={styles.stateText}>Đang tải danh sách vai trò...</Text>
          </View>
        ) : roles && roles.length === 0 ? (
          <Text style={styles.stateText}>
            Công ty chưa có vai trò nào. Hãy tạo vai trò trước khi mời thành viên.
          </Text>
        ) : (
          <View style={styles.roleList}>
            {roles?.map((role, index) => {
              const selected = role.id === selectedRoleId;
              return (
                <Pressable
                  key={role.id}
                  testID="invite-member.role"
                  accessibilityRole="radio"
                  accessibilityLabel={role.name}
                  accessibilityState={{ checked: selected }}
                  onPress={() => selectRole(role)}
                  style={({ pressed }) => [
                    styles.roleOption,
                    selected && styles.roleOptionSelected,
                    pressed && styles.roleOptionPressed,
                  ]}
                >
                  <View style={styles.roleCopy}>
                    <Text style={styles.roleName}>
                      {index + 1}. {role.name}
                    </Text>
                    <Text style={styles.roleCode}>{role.code}</Text>
                  </View>
                  <Text style={[styles.roleCheck, selected && styles.roleCheckSelected]}>
                    {selected ? '●' : '○'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View style={styles.section}>
        <AppButton
          testID="invite-member.create"
          label={creating ? 'Đang tạo...' : 'Tạo lời mời'}
          disabled={!canCreate}
          onPress={() => void create()}
        />
        {creating ? (
          <Text style={styles.stateText}>Đang tạo mã lời mời...</Text>
        ) : null}
      </View>

      {invitation ? (
        <Surface testID="invite-member.result" accessibilityLabel="Kết quả lời mời">
          <Text style={styles.resultLabel}>MÃ LỜI MỜI</Text>
          <Text testID="invite-member.code" selectable style={styles.code}>
            {invitation.token}
          </Text>
          <View style={styles.resultMeta}>
            <StatusPill label={`Gợi ý mã: ${invitation.tokenHint}`} tone="info" />
            <StatusPill label={`Hạn: ${formatExpiry(invitation.expiresAt)}`} tone="warning" />
          </View>
          <Text style={styles.resultHint}>
            Mã chỉ hiển thị một lần — hãy chia sẻ ngay. Người nhận nhập mã này ở màn hình "Tham gia
            công ty".
          </Text>
          <AppButton
            testID="invite-member.share"
            label="Chia sẻ"
            variant="secondary"
            onPress={share}
          />
        </Surface>
      ) : null}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  section: { gap: tokens.spacing.md },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
  stateText: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
  roleList: { gap: tokens.spacing.sm },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.md,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  roleOptionSelected: { borderColor: tokens.color.primary, backgroundColor: tokens.color.primarySoft },
  roleOptionPressed: { opacity: 0.82 },
  roleCopy: { flex: 1, gap: 2 },
  roleName: { color: tokens.color.ink, fontSize: tokens.typography.body, fontWeight: '700' },
  roleCode: { color: tokens.color.muted, fontSize: tokens.typography.label },
  roleCheck: { color: tokens.color.muted, fontSize: 18 },
  roleCheckSelected: { color: tokens.color.primary },
  error: { color: tokens.color.danger, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
  resultLabel: { color: tokens.color.primary, fontSize: tokens.typography.label, fontWeight: '800' },
  code: {
    color: tokens.color.ink,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginVertical: tokens.spacing.sm,
  },
  resultMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  resultHint: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
});
