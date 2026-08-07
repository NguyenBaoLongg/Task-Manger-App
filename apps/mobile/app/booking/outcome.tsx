import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import {
  listCancellationReasons,
  recordOutcome,
  rescheduleBooking,
} from '@/features/booking/outcome-actions';
import { AppButton, ScreenFrame, SectionHeading, Surface } from '@/components/ui/ScreenPrimitives';
import { tokens } from '@/theme/tokens';

type Reason = { id: string; label?: string; name?: string; active?: boolean };

export default function BookingOutcomeScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const context = useTenantContextStore((state) => state.context);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [reasonVersionId, setReasonVersionId] = useState('');
  const [scheduledStartAt, setScheduledStartAt] = useState(new Date().toISOString());
  const [stateVersion, setStateVersion] = useState('0');
  const [status, setStatus] = useState<string>();

  useEffect(() => {
    if (!context) return;
    void getAuthenticatedClient()
      .then((client) => listCancellationReasons(client, context.tenantId))
      .then((value) => {
        const items = ((value as { items?: Reason[] }).items ?? []).filter(
          (item) => item.active !== false,
        );
        setReasons(items);
        if (items[0]) setReasonVersionId(items[0].id);
      })
      .catch(() => setStatus('Không thể tải lý do hủy hoặc dời lịch.'));
  }, [context]);

  const submit = async (outcome: 'CANCELLED' | 'RESCHEDULED') => {
    if (!context || !bookingId || !reasonVersionId) {
      setStatus('Chọn một lý do còn hiệu lực trước khi gửi.');
      return;
    }
    const expectedStateVersion = Number(stateVersion);
    try {
      const client = await getAuthenticatedClient();
      if (outcome === 'CANCELLED')
        await recordOutcome(client, context.tenantId, bookingId, {
          outcome,
          reasonVersionId,
          expectedStateVersion,
          idempotencyKey: `outcome-${bookingId}-${expectedStateVersion}`,
        });
      else
        await rescheduleBooking(client, context.tenantId, bookingId, {
          scheduledStartAt,
          assignedMembershipId: context.membershipId,
          reasonVersionId,
          expectedStateVersion,
          idempotencyKey: `reschedule-${bookingId}-${expectedStateVersion}`,
        });
      router.back();
    } catch {
      setStatus('Booking đã thay đổi trên server. Tải lại chi tiết rồi thử lại.');
    }
  };

  return (
    <ScreenFrame
      testID="booking.outcome.screen"
      eyebrow="ADSUP / BOOKING"
      title="Hủy hoặc dời lịch"
      subtitle="Chọn lý do đang hiệu lực và gửi thao tác idempotent để tránh cập nhật trùng."
    >
      <Surface style={styles.card}>
        <SectionHeading
          title="Điều kiện cập nhật"
          detail={bookingId ? `#${bookingId}` : undefined}
        />
        <View style={styles.field}>
          <Text style={styles.label}>STATE VERSION</Text>
          <TextInput
            accessibilityLabel="Expected state version"
            testID="booking.outcome.state-version"
            value={stateVersion}
            onChangeText={setStateVersion}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={tokens.color.muted}
            style={styles.input}
          />
        </View>
      </Surface>

      <Surface style={styles.card}>
        <SectionHeading title="Lý do" detail={`${reasons.length} lý do`} />
        <View style={styles.reasonList}>
          {reasons.map((reason) => {
            const selected = reason.id === reasonVersionId;
            return (
              <AppButton
                key={reason.id}
                label={reason.label ?? reason.name ?? reason.id}
                variant={selected ? 'primary' : 'secondary'}
                onPress={() => setReasonVersionId(reason.id)}
              />
            );
          })}
          {reasons.length === 0 ? (
            <Text style={styles.body}>Chưa có lý do đang hiệu lực.</Text>
          ) : null}
        </View>
      </Surface>

      <Surface style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>GIỜ HẸN MỚI</Text>
          <TextInput
            accessibilityLabel="New scheduled start"
            testID="booking.outcome.new-start"
            value={scheduledStartAt}
            onChangeText={setScheduledStartAt}
            placeholder="YYYY-MM-DDTHH:mm:ss.sssZ"
            placeholderTextColor={tokens.color.muted}
            style={styles.input}
          />
        </View>
        <View style={styles.actions}>
          <AppButton
            label="Dời lịch"
            testID="booking.outcome.reschedule-submit"
            onPress={() => void submit('RESCHEDULED')}
            disabled={!reasonVersionId}
          />
          <AppButton
            label="Hủy booking"
            testID="booking.outcome.cancel-submit"
            variant="secondary"
            onPress={() => void submit('CANCELLED')}
            disabled={!reasonVersionId}
          />
        </View>
      </Surface>

      {status ? (
        <Text accessibilityRole="alert" style={styles.status}>
          {status}
        </Text>
      ) : null}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  card: { gap: tokens.spacing.lg },
  field: { gap: 7 },
  label: { color: tokens.color.muted, fontSize: tokens.typography.label, fontWeight: '800' },
  input: {
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
    color: tokens.color.ink,
    fontSize: tokens.typography.body,
  },
  reasonList: { gap: tokens.spacing.sm },
  body: { color: tokens.color.muted, fontSize: tokens.typography.body, lineHeight: 23 },
  actions: { gap: tokens.spacing.sm },
  status: { color: tokens.color.info, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
});
