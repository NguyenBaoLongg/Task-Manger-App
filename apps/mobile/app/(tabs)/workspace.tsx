import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton, ScreenFrame, SectionHeading, Surface } from '@/components/ui/ScreenPrimitives';
import { clearSession } from '@/features/auth/session-runtime';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import { tokens } from '@/theme/tokens';

const actions = [
  {
    title: 'Chấm công',
    body: 'Video, lịch ca và trạng thái hôm nay',
    route: '/attendance' as const,
  },
  {
    title: 'Đơn nghỉ & duyệt',
    body: 'Gửi đơn hoặc xử lý yêu cầu',
    route: '/approvals/request' as const,
  },
  {
    title: 'Sổ phạt',
    body: 'Theo dõi penalty và chứng từ',
    route: '/attendance/penalties' as const,
  },
  {
    title: 'Lịch booking',
    body: 'Khách hẹn, đến và trạng thái',
    route: '/booking/calendar' as const,
  },
];

export default function WorkspaceScreen() {
  const context = useTenantContextStore((state) => state.context);
  const clearContext = useTenantContextStore((state) => state.clear);

  const switchBranch = () => {
    if (!context) {
      router.replace('/(auth)/workspace-selection');
      return;
    }
    router.push({
      pathname: '/(auth)/branch-selection',
      params: { tenantId: context.tenantId, membershipId: context.membershipId },
    });
  };

  const logout = async () => {
    await clearSession();
    clearContext();
    router.replace('/(auth)/sign-in');
  };

  return (
    <ScreenFrame
      testID="workspace.screen"
      eyebrow="ADSUP / WORKSPACE"
      title="Không gian làm việc"
      subtitle="Các luồng vận hành hằng ngày, gom trong một nơi."
    >
      <Surface style={styles.scopePanel} accessibilityLabel="Phạm vi workspace hiện tại">
        <Text style={styles.scopeLabel}>WORKSPACE HIỆN TẠI</Text>
        <Text style={styles.scopeTitle}>Công ty TNHH ABC</Text>
        <Text style={styles.scopeBody}>Cơ sở và quyền được lấy từ membership của bạn.</Text>
        <View style={styles.scopeActions}>
          <AppButton
            testID="workspace.switch-branch"
            label="Doi co so"
            variant="secondary"
            onPress={switchBranch}
          />
          <AppButton
            testID="workspace.logout"
            label="Dang xuat"
            variant="quiet"
            onPress={() => void logout()}
          />
        </View>
      </Surface>
      <View style={styles.section}>
        <SectionHeading title="Truy cập nhanh" detail="4 luồng chính" />
        <View style={styles.grid}>
          {actions.map((action, index) => (
            <Surface key={action.title} style={styles.action}>
              <Text style={styles.index}>0{index + 1}</Text>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionBody}>{action.body}</Text>
              <AppButton
                testID={`workspace.action.${index + 1}`}
                label={`Mở ${action.title}`}
                variant="quiet"
                onPress={() => router.push(action.route)}
              />
            </Surface>
          ))}
        </View>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  scopePanel: {
    backgroundColor: tokens.color.primarySoft,
    borderColor: tokens.color.primaryMuted,
    gap: 7,
  },
  scopeLabel: { color: tokens.color.info, fontSize: tokens.typography.label, fontWeight: '800' },
  scopeTitle: { color: tokens.color.ink, fontSize: tokens.typography.heading, fontWeight: '800' },
  scopeBody: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
  scopeActions: { gap: tokens.spacing.sm, marginTop: tokens.spacing.sm },
  section: { gap: tokens.spacing.md },
  grid: { gap: tokens.spacing.md },
  action: { gap: 7 },
  index: { color: tokens.color.accent, fontSize: tokens.typography.label, fontWeight: '800' },
  actionTitle: { color: tokens.color.ink, fontSize: tokens.typography.heading, fontWeight: '800' },
  actionBody: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
});
