import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AppButton, ScreenFrame, StatusPill } from '@/components/ui/ScreenPrimitives';
import { tokens } from '@/theme/tokens';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import { myPermissions, selectBranch, type Branch } from '@/features/workspace/workspace-queries';
import { createBranchScope } from '@/features/workspace/branch-scope';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import { createWorkspaceSelectionStorage } from '@/tenant/workspace-selection-storage';
import { EmptyState, ErrorState, LoadingState } from '@/components/async-states/AsyncState';

const selectionStorage = createWorkspaceSelectionStorage();

export default function BranchSelectionScreen() {
  const { tenantId, membershipId } = useLocalSearchParams<{
    tenantId: string;
    membershipId?: string;
  }>();
  const setContext = useTenantContextStore((state) => state.setContext);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!tenantId) return undefined;
      let active = true;
      void getAuthenticatedClient()
        .then((client) =>
          Promise.all([
            selectBranch(client, tenantId),
            // The chosen scope carries the caller's permission codes; screens like the chat tab
            // gate actions on them, so an empty list would hide legitimate capabilities.
            myPermissions(client, tenantId).catch(() => []),
          ]),
        )
        .then(([items, codes]) => {
          if (active) {
            setBranches(items);
            setPermissions(codes);
            setError(false);
          }
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
    }, [tenantId]),
  );

  if (loading) return <LoadingState label="Đang tải cơ sở" />;
  if (error) return <ErrorState label="Không thể tải cơ sở" />;

  return (
    <ScreenFrame
      testID="branch-selection.screen"
      eyebrow="PHẠM VI LÀM VIỆC"
      title="Chọn cơ sở"
      subtitle="Bạn chỉ nhìn thấy dữ liệu thuộc cơ sở được cấp quyền."
    >
      {branches.length === 0 ? (
        <View style={styles.emptyBlock}>
          <EmptyState label="Công ty chưa có cơ sở nào" />
          <Text style={styles.emptyHint}>
            Tạo cơ sở đầu tiên để bắt đầu sử dụng workspace.
          </Text>
          <AppButton
            testID="branch.create"
            label="Tạo cơ sở"
            onPress={() =>
              router.push({
                pathname: '/(auth)/create-branch',
                params: { tenantId, membershipId: membershipId ?? '' },
              })
            }
          />
        </View>
      ) : (
        <View style={styles.list}>
          {branches.map((branch) => (
            <Pressable
              key={branch.id}
              testID="branch.option"
              accessibilityRole="button"
              accessibilityLabel={branch.name}
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              onPress={() => {
                setContext(
                  createBranchScope(
                    {
                      tenantId,
                      membershipId: membershipId ?? 'current-membership',
                      permissions,
                      version: 1,
                    },
                    branch.id,
                  ),
                );
                // Remember the choice so a relaunch lands on the dashboard instead of asking again.
                // Only the identifiers are stored; membership and scope are re-read on restore.
                void selectionStorage.save({ tenantId, branchId: branch.id });
                router.replace('/(tabs)/dashboard');
              }}
            >
              <View style={styles.optionIcon}>
                <Ionicons name="storefront-outline" size={24} color={tokens.color.primary} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>{branch.name}</Text>
                <StatusPill
                  label={
                    branch.status === 'ACTIVE' ? 'Đang hoạt động' : (branch.status ?? 'Sẵn sàng')
                  }
                  tone={branch.status === 'ACTIVE' ? 'success' : 'neutral'}
                />
              </View>
              <Ionicons name="chevron-forward" size={22} color={tokens.color.primary} />
            </Pressable>
          ))}
        </View>
      )}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  emptyBlock: { gap: tokens.spacing.lg },
  emptyHint: {
    color: tokens.color.muted,
    fontSize: tokens.typography.body,
    lineHeight: 22,
    textAlign: 'center',
  },
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
