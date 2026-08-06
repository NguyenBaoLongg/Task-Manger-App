import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import {
  submitWorkflowRequest,
  workflowRequestFieldSchema,
} from '@/features/approvals/request-adapters';
import {
  AppButton,
  ScreenFrame,
  SectionHeading,
  StatusPill,
  Surface,
} from '@/components/ui/ScreenPrimitives';
import { tokens } from '@/theme/tokens';

const durationOptions = [
  { label: 'Cả ngày', value: 'FULL_DAY' },
  { label: 'Nghỉ sáng', value: 'MORNING_HALF_DAY' },
  { label: 'Nhiều ngày', value: 'DATE_RANGE' },
] as const;

export default function RequestScreen() {
  const context = useTenantContextStore((state) => state.context);
  const [duration, setDuration] = useState<'FULL_DAY' | 'MORNING_HALF_DAY' | 'DATE_RANGE'>(
    'FULL_DAY',
  );
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<string>();

  const submit = async () => {
    if (!context || reason.trim().length < 3) {
      setStatus('Cần nhập lý do rõ ràng.');
      return;
    }
    try {
      const client = await getAuthenticatedClient();
      await submitWorkflowRequest(client, context.tenantId, {
        requestType: 'LEAVE_SCHEDULE',
        duration,
        startDate,
        endDate,
        reason,
        idempotencyKey: `leave-${Date.now()}`,
      });
      setStatus('Đã gửi đơn, chờ quản lý duyệt.');
    } catch {
      setStatus('Không thể gửi đơn. Vui lòng tải lại.');
    }
  };

  return (
    <ScreenFrame
      testID="approval.request.screen"
      eyebrow="ADSUP / APPROVAL"
      title="Tạo đơn nghỉ"
      subtitle="Gửi đơn nghỉ cả ngày, nghỉ sáng hoặc nghỉ nhiều ngày để quản lý phê duyệt."
    >
      <Surface style={styles.policyCard}>
        <SectionHeading
          title="Thông tin cần có"
          detail={`${workflowRequestFieldSchema.length} trường`}
        />
        <View style={styles.fieldList}>
          {workflowRequestFieldSchema.map((field) => (
            <StatusPill key={field.name} label={field.label} tone="info" />
          ))}
        </View>
      </Surface>

      <Surface style={styles.formCard}>
        <Text style={styles.label}>LOẠI NGHỈ</Text>
        <View accessibilityRole="tablist" style={styles.segmented}>
          {durationOptions.map((option) => {
            const selected = duration === option.value;
            return (
              <AppButton
                key={option.value}
                label={option.label}
                variant={selected ? 'primary' : 'secondary'}
                onPress={() => setDuration(option.value)}
              />
            );
          })}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>TỪ NGÀY</Text>
          <TextInput
            accessibilityLabel="Từ ngày"
            testID="approval.request.start-date"
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={tokens.color.muted}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>ĐẾN NGÀY</Text>
          <TextInput
            accessibilityLabel="Đến ngày"
            testID="approval.request.end-date"
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={tokens.color.muted}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>LÝ DO</Text>
          <TextInput
            accessibilityLabel="Lý do nghỉ"
            testID="approval.request.reason"
            value={reason}
            onChangeText={setReason}
            placeholder="Nhập lý do rõ ràng"
            placeholderTextColor={tokens.color.muted}
            multiline
            style={[styles.input, styles.textArea]}
          />
        </View>

        <AppButton
          label="Gửi đơn"
          onPress={() => void submit()}
          disabled={reason.trim().length < 3}
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
  policyCard: { gap: tokens.spacing.md },
  fieldList: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  formCard: { gap: tokens.spacing.lg },
  segmented: { gap: tokens.spacing.sm },
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
  textArea: { minHeight: 92, paddingTop: tokens.spacing.md, textAlignVertical: 'top' },
  status: { color: tokens.color.info, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
});
