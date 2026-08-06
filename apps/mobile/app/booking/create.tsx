import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import { createBookingActions } from '@/features/booking/booking-actions';
import { listFormTemplates, loadFormVersion, type FormVersion } from '@/forms/form-version-loader';
import { JsonSchemaRenderer } from '@/forms/json-schema-renderer';
import { validateFormData } from '@/forms/form-validation';
import {
  AppButton,
  ScreenFrame,
  SectionHeading,
  StatusPill,
  Surface,
} from '@/components/ui/ScreenPrimitives';
import { tokens } from '@/theme/tokens';

export default function BookingCreateScreen() {
  const context = useTenantContextStore((state) => state.context);
  const [form, setForm] = useState<FormVersion>();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [scheduledStartAt, setScheduledStartAt] = useState(new Date().toISOString());
  const [status, setStatus] = useState<string>();

  useEffect(() => {
    if (!context) return;
    void getAuthenticatedClient()
      .then((client) => listFormTemplates(client, context.tenantId))
      .then((value) => {
        const first = ((value as { items?: Array<{ id: string; publishedVersionId?: string }> })
          .items ?? [])[0];
        if (!first?.publishedVersionId) return;
        return getAuthenticatedClient().then((client) =>
          loadFormVersion(client, context.tenantId, first.id, first.publishedVersionId!),
        );
      })
      .then((value) => {
        if (value) setForm(value as FormVersion);
      })
      .catch(() => setStatus('Không thể tải form booking đã publish.'));
  }, [context]);

  const submit = async (walkIn: boolean) => {
    if (!context || !form) return;
    const validation = validateFormData(
      form.schema as Parameters<typeof validateFormData>[0],
      values,
    );
    if (!validation.valid) {
      setStatus('Vui lòng hoàn tất các trường bắt buộc.');
      return;
    }
    try {
      const client = await getAuthenticatedClient();
      const actions = createBookingActions(client, context.tenantId);
      const common = {
        branchId: context.branchId ?? '',
        formData: values,
        formTemplateId: form.templateId,
        formVersionId: form.id,
      };
      if (walkIn) await actions.walkIn(common);
      else await actions.scheduled({ ...common, scheduledStartAt });
      router.replace('/booking/calendar');
    } catch {
      setStatus('Không thể tạo booking. Kiểm tra lịch trùng hoặc thử lại.');
    }
  };

  return (
    <ScreenFrame
      testID="booking.create.screen"
      eyebrow="ADSUP / BOOKING"
      title="Tạo booking"
      subtitle="Nhập thông tin khách bằng form động và chọn lịch hẹn phù hợp."
    >
      <Surface style={styles.card}>
        <View style={styles.headerRow}>
          <SectionHeading title="Thông tin khách" detail={form ? 'Form đã publish' : 'Đang tải'} />
          <StatusPill label={form ? 'Sẵn sàng' : 'Loading'} tone={form ? 'success' : 'info'} />
        </View>
        {!form ? (
          <Text style={styles.body}>Đang tải biểu mẫu booking của tenant...</Text>
        ) : (
          <JsonSchemaRenderer
            schema={form.schema}
            values={values}
            onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))}
          />
        )}
      </Surface>

      <Surface style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>GIỜ HẸN</Text>
          <TextInput
            accessibilityLabel="Scheduled start"
            testID="booking.create.scheduled-start"
            value={scheduledStartAt}
            onChangeText={setScheduledStartAt}
            placeholder="YYYY-MM-DDTHH:mm:ss.sssZ"
            placeholderTextColor={tokens.color.muted}
            style={styles.input}
          />
        </View>
        <View style={styles.actions}>
          <AppButton
            label="Tạo lịch hẹn"
            onPress={() => void submit(false)}
            testID="booking.create.scheduled-submit"
            disabled={!form}
          />
          <AppButton
            label="Khách walk-in"
            testID="booking.create.walk-in-submit"
            variant="secondary"
            onPress={() => void submit(true)}
            disabled={!form}
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
  headerRow: { gap: tokens.spacing.md },
  body: { color: tokens.color.muted, fontSize: tokens.typography.body, lineHeight: 23 },
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
  actions: { gap: tokens.spacing.sm },
  status: { color: tokens.color.info, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
});
