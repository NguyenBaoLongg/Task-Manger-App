import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScreenFrame, StatusPill } from '@/components/ui/ScreenPrimitives';
import { tokens } from '@/theme/tokens';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import { selectWorkspace, type WorkspaceMembership } from '@/features/workspace/workspace-queries';
import { LoadingState, ErrorState } from '@/components/async-states/AsyncState';

export default function WorkspaceSelectionScreen() {
  const [workspaces, setWorkspaces] = useState<WorkspaceMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void getAuthenticatedClient()
      .then(selectWorkspace)
      .then((items) => {
        if (active) setWorkspaces(items);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <LoadingState label="Đang tải workspace" />;
  if (error) return <ErrorState label="Không thể tải workspace" />;

  return (
    <ScreenFrame
      eyebrow="TÀI KHOẢN CỦA BẠN"
      title="Chọn workspace"
      subtitle="Chọn công ty bạn muốn làm việc trong phiên này."
    >
      <View style={styles.list}>
        {workspaces.map((workspace) => (
          <Pressable
            key={workspace.membershipId}
            testID="workspace.option"
            style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
            onPress={() =>
              router.push({
                pathname: '/(auth)/branch-selection',
                params: { tenantId: workspace.tenantId, membershipId: workspace.membershipId },
              })
            }
            accessibilityRole="button"
            accessibilityLabel={workspace.name}
          >
            <View style={styles.optionIcon}>
              <Ionicons name="business-outline" size={24} color={tokens.color.primary} />
            </View>
            <View style={styles.optionCopy}>
              <Text style={styles.optionTitle}>{workspace.name}</Text>
              <StatusPill
                label={
                  workspace.status === 'ACTIVE'
                    ? 'Đang hoạt động'
                    : (workspace.status ?? 'Sẵn sàng')
                }
                tone={workspace.status === 'ACTIVE' ? 'success' : 'neutral'}
              />
            </View>
            <Ionicons name="chevron-forward" size={22} color={tokens.color.primary} />
          </Pressable>
        ))}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  list: { gap: tokens.spacing.md },
  option: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: tokens.radius.lg,
  },
  optionPressed: { backgroundColor: tokens.color.primarySoft },
  optionIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.primarySoft,
  },
  optionCopy: { flex: 1, alignItems: 'flex-start', gap: tokens.spacing.sm },
  optionTitle: { color: tokens.color.ink, fontSize: 18, fontWeight: '800' },
});
