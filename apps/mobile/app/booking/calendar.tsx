import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import { listBookings } from '@/features/booking/booking-api';
import {
  formatBookingTime,
  normalizeBooking,
  normalizeCalendarFilters,
  type BookingRow,
} from '@/features/booking/calendar-model';
import { ErrorState, EmptyState, LoadingState } from '@/components/async-states/AsyncState';
import {
  AppButton,
  ScreenFrame,
  SectionHeading,
  StatusPill,
} from '@/components/ui/ScreenPrimitives';
import { tokens } from '@/theme/tokens';

const statusTone = (status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' => {
  if (status === 'COMPLETED' || status === 'ARRIVED') return 'success';
  if (status === 'CANCELLED' || status === 'NO_SHOW') return 'danger';
  if (status === 'SCHEDULED') return 'info';
  return 'warning';
};

export default function BookingCalendarScreen() {
  const context = useTenantContextStore((state) => state.context);
  const [businessDate, setBusinessDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<BookingRow[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const filters = useMemo(
    () => normalizeCalendarFilters({ businessDate, branchId: context?.branchId }),
    [businessDate, context?.branchId],
  );
  const load = () => {
    if (!context) {
      setState('ready');
      return;
    }
    setState('loading');
    void getAuthenticatedClient()
      .then((client) => listBookings(client, context.tenantId, filters))
      .then((page) => {
        const rows = (page as { items?: unknown[] }).items ?? [];
        setItems(rows.map(normalizeBooking).filter((row): row is BookingRow => Boolean(row)));
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, [context, filters]);

  if (state === 'loading') return <LoadingState label="Đang tải lịch booking" />;
  if (state === 'error') return <ErrorState label="Không thể tải lịch booking" onRetry={load} />;

  return (
    <ScreenFrame
      testID="booking.calendar.screen"
      eyebrow="ADSUP / BOOKING"
      title="Lịch khách"
      subtitle="Theo dõi lịch hẹn và cập nhật trạng thái trong ngày."
    >
      <View style={styles.toolbar}>
        <View style={styles.dateField}>
          <Text style={styles.fieldLabel}>NGÀY LÀM VIỆC</Text>
          <TextInput
            accessibilityLabel="Ngày làm việc"
            testID="booking.calendar.date"
            value={businessDate}
            onChangeText={setBusinessDate}
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={tokens.color.muted}
          />
        </View>
        <AppButton label="Tạo booking" onPress={() => router.push('/booking/create')} />
      </View>
      <SectionHeading title="Lịch trong ngày" detail={`${items.length} lịch hẹn`} />
      {items.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState label="Chưa có booking trong ngày này" />
          <AppButton
            label="Tạo lịch đầu tiên"
            variant="secondary"
            onPress={() => router.push('/booking/create')}
          />
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              testID="booking.calendar.row"
              accessibilityRole="button"
              accessibilityLabel={`Booking ${item.customerName ?? item.id}`}
              onPress={() => router.push(`/booking/${item.id}`)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.timeColumn}>
                <Text style={styles.time}>{formatBookingTime(item.scheduledStartAt)}</Text>
                <View style={styles.timeline} />
              </View>
              <View style={styles.rowContent}>
                <View style={styles.rowTopline}>
                  <Text style={styles.customer} numberOfLines={1}>
                    {item.customerName ?? 'Khách hàng'}
                  </Text>
                  <StatusPill label={item.status} tone={statusTone(item.status)} />
                </View>
                <Text style={styles.rowMeta}>Nhấn để xem chi tiết và cập nhật kết quả</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  toolbar: { gap: tokens.spacing.md },
  dateField: { gap: 7 },
  fieldLabel: { color: tokens.color.muted, fontSize: tokens.typography.label, fontWeight: '800' },
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
  empty: { gap: tokens.spacing.lg, paddingVertical: tokens.spacing.xl },
  list: { gap: tokens.spacing.sm },
  row: {
    minHeight: 88,
    flexDirection: 'row',
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.surface,
  },
  rowPressed: { opacity: 0.78 },
  timeColumn: { width: 54, alignItems: 'center', gap: 8 },
  time: { color: tokens.color.primary, fontSize: tokens.typography.bodySmall, fontWeight: '800' },
  timeline: { flex: 1, width: 2, backgroundColor: tokens.color.border },
  rowContent: { flex: 1, gap: 8 },
  rowTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  customer: {
    flex: 1,
    color: tokens.color.ink,
    fontSize: tokens.typography.body,
    fontWeight: '800',
  },
  rowMeta: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall },
});
