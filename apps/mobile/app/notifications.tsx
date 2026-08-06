import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenFrame, SectionHeading, StatusPill, Surface } from '@/components/ui/ScreenPrimitives';
import { unreadByKind, type Badge } from '@/notifications/badge-store';
import { tokens } from '@/theme/tokens';

const notificationRows = [
  {
    kind: 'PHOTO_DEBT',
    title: 'Photo debt',
    body: 'ARRIVED bookings missing proof photos are grouped here.',
    tone: 'warning',
  },
  {
    kind: 'APPROVAL',
    title: 'Pending approvals',
    body: 'Managers see badges when leave or workflow requests wait for action.',
    tone: 'info',
  },
  {
    kind: 'QUICK_ACTION',
    title: 'Quick actions',
    body: 'Lock-screen actions support ARRIVED proof and cancel/reschedule when native handlers are enabled.',
    tone: 'success',
  },
] as const;

const seedBadges: Badge[] = [
  { effectKey: 'photo-debt-demo', kind: 'PHOTO_DEBT' },
  { effectKey: 'approval-demo', kind: 'APPROVAL' },
];

export default function NotificationsScreen() {
  const counts = useMemo(() => unreadByKind(seedBadges), []);

  return (
    <ScreenFrame
      testID="notifications.screen"
      eyebrow="ADSUP / NOTIFICATIONS"
      title="Notifications"
      subtitle="Track badges and quick actions for booking, approvals, and action items."
    >
      <Surface style={styles.card}>
        <SectionHeading title="Current state" detail="Local MVP" />
        <View style={styles.list}>
          {notificationRows.map((item) => (
            <View
              key={item.title}
              testID={`notifications.${item.kind.toLowerCase()}`}
              style={styles.row}
            >
              <View style={styles.copy}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
              </View>
              <StatusPill label={`${counts[item.kind] ?? 0}`} tone={item.tone} />
            </View>
          ))}
        </View>
      </Surface>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  card: { gap: tokens.spacing.lg },
  list: { gap: tokens.spacing.md },
  row: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  copy: { flex: 1, gap: 5 },
  title: { color: tokens.color.ink, fontSize: tokens.typography.body, fontWeight: '800' },
  body: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
});
