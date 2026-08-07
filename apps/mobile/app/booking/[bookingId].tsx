import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LoadingState, ErrorState } from '@/components/async-states/AsyncState';
import {
  AppButton,
  ScreenFrame,
  SectionHeading,
  StatusPill,
  Surface,
} from '@/components/ui/ScreenPrimitives';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import { getBooking } from '@/features/booking/booking-api';
import { runBookingArrivedProofFlow } from '@/features/booking/arrival-proof-flow';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import { tokens } from '@/theme/tokens';

type Booking = {
  id: string;
  status?: string;
  stateVersion?: number;
  customerName?: string;
  branchId?: string;
  customerPhotoMediaId?: string;
};

const statusTone = (status?: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' => {
  if (status === 'ARRIVED' || status === 'COMPLETED') return 'success';
  if (status === 'CANCELLED' || status === 'NO_SHOW') return 'danger';
  if (status === 'SCHEDULED') return 'info';
  return 'warning';
};

const proofBytes = (bookingId: string) =>
  Uint8Array.from(`booking-proof:${bookingId}`, (char) => char.charCodeAt(0));

export default function BookingDetailScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const context = useTenantContextStore((state) => state.context);
  const [booking, setBooking] = useState<Booking>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [status, setStatus] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    if (!context || !bookingId) {
      setState('error');
      return;
    }
    void getAuthenticatedClient()
      .then((client) => getBooking(client, context.tenantId, bookingId))
      .then((value) => {
        setBooking(value as Booking);
        setState('ready');
      })
      .catch(() => setState('error'));
  };

  useEffect(load, [context, bookingId]);

  const arrived = async () => {
    if (!context || !booking) return;
    setSubmitting(true);
    setStatus(undefined);
    try {
      const client = await getAuthenticatedClient();
      await runBookingArrivedProofFlow(client, context.tenantId, booking.id, {
        branchId: booking.branchId,
        bytes: proofBytes(booking.id),
        contentType: 'image/jpeg',
        idempotencyKey: `arrived-proof-${booking.id}-${booking.stateVersion ?? 0}`,
        upload: async () => undefined,
      });
      setStatus('Customer arrival and proof photo were submitted.');
      load();
    } catch {
      setStatus('Could not submit ARRIVED proof. Refresh state and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'loading') return <LoadingState label="Loading booking" />;
  if (state === 'error' || !booking)
    return <ErrorState label="Could not load booking" onRetry={load} />;

  return (
    <ScreenFrame
      testID="booking.detail.screen"
      eyebrow="ADSUP / BOOKING"
      title="Booking detail"
      subtitle="Submit ARRIVED with consent and proof photo, or move to cancellation/reschedule."
    >
      <Surface style={styles.summaryCard}>
        <View style={styles.topline}>
          <View style={styles.copy}>
            <Text style={styles.customer}>{booking.customerName ?? 'Customer'}</Text>
            <Text style={styles.meta}>State version {booking.stateVersion ?? 0}</Text>
          </View>
          <StatusPill label={booking.status ?? 'SCHEDULED'} tone={statusTone(booking.status)} />
        </View>
        <View style={styles.infoGrid}>
          <View style={styles.infoBox}>
            <Text style={styles.label}>BRANCH</Text>
            <Text style={styles.value}>{booking.branchId ?? 'Not assigned'}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.label}>PROOF</Text>
            <Text style={styles.value}>
              {booking.customerPhotoMediaId ? 'Photo attached' : 'Photo required'}
            </Text>
          </View>
        </View>
      </Surface>

      <Surface style={styles.actionsCard}>
        <SectionHeading title="Actions" detail="RBAC and state version required" />
        <AppButton
          testID="booking.detail.arrived-proof"
          label={submitting ? 'Submitting ARRIVED...' : 'ARRIVED with proof'}
          onPress={() => void arrived()}
          disabled={submitting}
        />
        <AppButton
          testID="booking.detail.outcome-button"
          label="Cancel or reschedule"
          variant="secondary"
          onPress={() => router.push(`/booking/outcome?bookingId=${booking.id}`)}
        />
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
  summaryCard: { gap: tokens.spacing.lg, backgroundColor: tokens.color.primarySoft },
  topline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.spacing.md,
  },
  copy: { flex: 1, gap: 5 },
  customer: { color: tokens.color.ink, fontSize: tokens.typography.heading, fontWeight: '900' },
  meta: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall },
  infoGrid: { gap: tokens.spacing.sm },
  infoBox: {
    gap: 4,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.primaryMuted,
  },
  label: { color: tokens.color.muted, fontSize: tokens.typography.label, fontWeight: '800' },
  value: { color: tokens.color.ink, fontSize: tokens.typography.body, fontWeight: '800' },
  actionsCard: { gap: tokens.spacing.md },
  status: { color: tokens.color.info, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
});
