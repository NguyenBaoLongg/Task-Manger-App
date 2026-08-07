import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import {
  listEmployeeActionItems,
  type ActionItemPage,
} from '@/features/action-items/action-item-feed';
import { getDailyKpiProgress } from '@/features/dashboard/kpi-queries';
import { KpiSummary } from '@/features/dashboard/KpiSummary';
import { EmptyState, ErrorState, LoadingState } from '@/components/async-states/AsyncState';
import { AppButton, ScreenFrame, SectionHeading, Surface } from '@/components/ui/ScreenPrimitives';
import { tokens } from '@/theme/tokens';

const quickActions = [
  {
    label: 'Lịch khách',
    detail: 'Xem lịch hôm nay',
    icon: 'calendar-outline' as const,
    route: '/booking/calendar' as const,
  },
  {
    label: 'Đơn nghỉ',
    detail: 'Gửi và theo dõi',
    icon: 'document-text-outline' as const,
    route: '/approvals/request' as const,
  },
];

export default function DashboardScreen() {
  const context = useTenantContextStore((state) => state.context);
  const [page, setPage] = useState<ActionItemPage>();
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof getDailyKpiProgress>>>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const date = new Date().toISOString().slice(0, 10);

  const load = () => {
    if (!context) {
      setState('ready');
      return;
    }
    setState('loading');
    void getAuthenticatedClient()
      .then((client) =>
        Promise.all([
          listEmployeeActionItems(client, context.tenantId),
          getDailyKpiProgress(client, context.tenantId, date),
        ]),
      )
      .then(([items, kpi]) => {
        setPage(items);
        setProgress(kpi);
        setState('ready');
      })
      .catch(() => setState('error'));
  };

  useEffect(() => {
    load();
  }, [context, date]);

  if (state === 'loading') return <LoadingState label="Đang tải tổng quan" />;
  if (state === 'error') return <ErrorState label="Không thể tải tổng quan" onRetry={load} />;

  return (
    <ScreenFrame
      testID="dashboard.screen"
      eyebrow="ADSUP / HÔM NAY"
      title="Tổng quan"
      subtitle="Các thông tin vận hành cần chú ý trong ngày."
    >
      <Surface style={styles.hero} accessibilityLabel="Trạng thái hôm nay">
        <View style={styles.heroTopline}>
          <View style={styles.shiftIdentity}>
            <View style={styles.heroIcon}>
              <Ionicons name="time-outline" size={22} color={tokens.color.inkInverted} />
            </View>
            <View>
              <Text style={styles.heroKicker}>CA LÀM VIỆC</Text>
              <Text style={styles.heroTitle}>Sẵn sàng vận hành</Text>
            </View>
          </View>
          <View style={styles.heroStatus}>
            <View style={styles.heroStatusDot} />
            <Text style={styles.heroStatusText}>Hoạt động</Text>
          </View>
        </View>
        <Text style={styles.heroBody}>
          Kiểm tra chấm công và các việc cần xử lý trước khi bắt đầu ca.
        </Text>
        <AppButton
          testID="dashboard.attendance-button"
          label="Mở chấm công"
          variant="secondary"
          onPress={() => router.push('/attendance')}
        />
      </Surface>

      <View style={styles.quickGrid}>
        {quickActions.map((action) => (
          <Pressable
            key={action.label}
            testID={
              action.route === '/booking/calendar'
                ? 'dashboard.booking-button'
                : 'dashboard.approvals-button'
            }
            accessibilityRole="button"
            accessibilityLabel={`Mở ${action.label}`}
            onPress={() => router.push(action.route)}
            style={({ pressed }) => [styles.quickAction, pressed && styles.quickPressed]}
          >
            <View style={styles.quickTopline}>
              <View style={styles.quickIcon}>
                <Ionicons name={action.icon} size={22} color={tokens.color.primary} />
              </View>
              <Ionicons name="arrow-forward" size={19} color={tokens.color.primary} />
            </View>
            <View style={styles.quickCopy}>
              <Text style={styles.quickTitle}>{action.label}</Text>
              <Text style={styles.quickBody}>{action.detail}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      {progress ? <KpiSummary progress={progress} /> : null}

      <View style={styles.section} accessibilityLabel="Việc cần hoàn thành">
        <SectionHeading title="Việc cần làm" detail={`${page?.openCount ?? 0} đang mở`} />
        {page?.items?.length ? (
          <Surface style={styles.actionList}>
            {page.items.slice(0, 3).map((item, index) => (
              <View
                key={item.id}
                testID={index === 0 ? 'dashboard.first-action-item' : undefined}
                style={[styles.actionRow, index > 0 && styles.actionDivider]}
              >
                <View style={styles.actionIcon}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={21}
                    color={tokens.color.primary}
                  />
                </View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle} numberOfLines={1}>
                    {item.title ?? item.itemType ?? 'Việc cần xử lý'}
                  </Text>
                  <Text style={styles.actionMeta}>{item.state}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={tokens.color.muted} />
              </View>
            ))}
          </Surface>
        ) : (
          <Surface style={styles.emptySurface}>
            <EmptyState label="Chưa có việc cần hoàn thành" />
          </Surface>
        )}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: tokens.spacing.lg,
    backgroundColor: tokens.color.primary,
    borderColor: tokens.color.primary,
  },
  heroTopline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.spacing.md,
  },
  shiftIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
  heroIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.lg,
    backgroundColor: '#FFFFFF24',
  },
  heroKicker: {
    color: tokens.color.primaryMuted,
    fontSize: tokens.typography.label,
    fontWeight: '800',
  },
  heroTitle: {
    color: tokens.color.inkInverted,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '800',
    marginTop: 2,
  },
  heroStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  heroStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: tokens.color.success },
  heroStatusText: { color: tokens.color.ink, fontSize: 11, fontWeight: '800' },
  heroBody: { color: '#EAF4FF', fontSize: tokens.typography.bodySmall, lineHeight: 21 },
  quickGrid: { flexDirection: 'row', gap: tokens.spacing.md },
  quickAction: {
    flex: 1,
    minHeight: 116,
    justifyContent: 'space-between',
    padding: tokens.spacing.lg,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  quickPressed: { backgroundColor: tokens.color.primarySoft },
  quickTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quickIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.primarySoft,
  },
  quickCopy: { gap: 3, marginTop: tokens.spacing.md },
  quickTitle: { color: tokens.color.ink, fontSize: 17, fontWeight: '800' },
  quickBody: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall },
  section: { gap: tokens.spacing.md },
  actionList: { paddingVertical: 4 },
  actionRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionDivider: { borderTopWidth: 1, borderTopColor: tokens.color.border },
  actionIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.primarySoft,
  },
  actionCopy: { flex: 1, gap: 4 },
  actionTitle: { color: tokens.color.ink, fontSize: tokens.typography.body, fontWeight: '700' },
  actionMeta: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall },
  emptySurface: { minHeight: 92, justifyContent: 'center' },
});
