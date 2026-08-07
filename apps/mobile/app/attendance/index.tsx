import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import { getAttendanceSchedules } from '@/features/attendance/attendance-queries';
import { AttendanceSummary } from '@/features/attendance/attendance-summary';
import { AppButton, ScreenFrame, SectionHeading, Surface } from '@/components/ui/ScreenPrimitives';
import { tokens } from '@/theme/tokens';

type ScheduleResult = { state?: string; lateMinutes?: number };

export default function AttendanceScreen() {
  const context = useTenantContextStore((state) => state.context);
  const [schedule, setSchedule] = useState<ScheduleResult>();
  useEffect(() => {
    if (!context) return;
    let active = true;
    void getAuthenticatedClient()
      .then((client) =>
        getAttendanceSchedules(client, context.tenantId, new Date().toISOString().slice(0, 10)),
      )
      .then((value) => {
        const raw: unknown = value;
        const item = Array.isArray(raw) ? (raw as unknown[])[0] : raw;
        if (active && item && typeof item === 'object') setSchedule(item as ScheduleResult);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [context]);

  return (
    <ScreenFrame
      testID="attendance.screen"
      eyebrow="ADSUP / ATTENDANCE"
      title="Chấm công"
      subtitle="Hoàn tất check-in video trước khi bắt đầu ca."
    >
      <Surface style={styles.todayCard} accessibilityLabel="Chấm công video">
        <SectionHeading title="Hôm nay" detail="Ca hiện tại" />
        <View style={styles.statusBlock}>
          <AttendanceSummary
            status={schedule?.state ?? 'PENDING'}
            lateMinutes={schedule?.lateMinutes ?? 0}
          />
        </View>
        <AppButton
          testID="attendance.video-button"
          label="Quay video check-in"
          onPress={() => router.push('/attendance/video-capture')}
        />
      </Surface>
      <View style={styles.section} accessibilityLabel="Nghỉ và duyệt">
        <SectionHeading title="Nghỉ và duyệt" detail="Cần xử lý" />
        <Surface style={styles.actionRow}>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Đơn nghỉ đột xuất</Text>
            <Text style={styles.actionBody}>Chọn nghỉ cả ngày, buổi sáng hoặc nhiều ngày.</Text>
          </View>
          <AppButton
            label="Tạo đơn"
            testID="attendance.leave-request-button"
            variant="secondary"
            onPress={() => router.push('/approvals/request')}
          />
        </Surface>
      </View>
      <View style={styles.section} accessibilityLabel="Sổ phạt">
        <SectionHeading title="Sổ phạt" detail="Minh bạch theo ngày" />
        <Surface style={styles.actionRow}>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Sổ phạt cá nhân</Text>
            <Text style={styles.actionBody}>Xem lý do, số tiền và trạng thái chứng từ.</Text>
          </View>
          <AppButton
            label="Mở sổ phạt"
            testID="attendance.penalties-button"
            variant="quiet"
            onPress={() => router.push('/attendance/penalties')}
          />
        </Surface>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  todayCard: {
    backgroundColor: tokens.color.primarySoft,
    borderColor: tokens.color.primaryMuted,
    gap: 18,
  },
  statusBlock: { minHeight: 46, justifyContent: 'center' },
  section: { gap: tokens.spacing.md },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
  actionCopy: { flex: 1, gap: 5 },
  actionTitle: { color: tokens.color.ink, fontSize: tokens.typography.body, fontWeight: '800' },
  actionBody: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
});
