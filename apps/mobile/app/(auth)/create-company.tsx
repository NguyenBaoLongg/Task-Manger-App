import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton, ScreenFrame, Surface } from '@/components/ui/ScreenPrimitives';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import {
  createCompany,
  freshCreateCompanyIdempotencyKey,
  CreateCompanyError,
} from '@/features/tenant/create-company-model';
import { tokens } from '@/theme/tokens';

export default function CreateCompanyScreen() {
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const pendingRef = useRef<{ key: string; name: string } | undefined>(undefined);
  const busyRef = useRef(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busyRef.current) return;
    let pending = pendingRef.current;
    if (!pending || pending.name !== trimmed) {
      pending = { name: trimmed, key: freshCreateCompanyIdempotencyKey() };
      pendingRef.current = pending;
    }
    busyRef.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const client = await getAuthenticatedClient();
      const outcome = await createCompany(
        client,
        { name: trimmed, timezone: timezone.trim() },
        { idempotencyKey: pending.key },
      );
      if (outcome.kind === 'created') {
        pendingRef.current = undefined;
        router.replace('/(auth)/workspace-selection');
        return;
      }
      router.replace('/(auth)/profile-confirmation');
    } catch (caught) {
      if (caught instanceof CreateCompanyError) {
        setError(caught.message);
        if (caught.kind !== 'network') pendingRef.current = undefined;
      } else {
        setError('Không thể tạo công ty. Hãy thử lại.');
        pendingRef.current = undefined;
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const canSubmit = name.trim().length >= 2 && !busy;

  return (
    <ScreenFrame
      testID="create-company.screen"
      eyebrow="ADSUP / TENANT"
      title="Tạo công ty"
      subtitle="Tạo workspace của riêng bạn và trở thành chủ doanh nghiệp."
    >
      <Surface style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>TÊN CÔNG TY</Text>
          <TextInput
            testID="create-company.name"
            accessibilityLabel="Tên công ty"
            value={name}
            onChangeText={setName}
            placeholder="Nhập tên công ty"
            placeholderTextColor={tokens.color.muted}
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>MÚI GIỜ</Text>
          <TextInput
            testID="create-company.timezone"
            accessibilityLabel="Múi giờ"
            value={timezone}
            onChangeText={setTimezone}
            placeholder="Asia/Ho_Chi_Minh"
            placeholderTextColor={tokens.color.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>
        {error ? (
          <Text testID="create-company.error" accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <AppButton
          testID="create-company.submit"
          label={busy ? 'Đang xử lý...' : 'Tạo công ty'}
          disabled={!canSubmit}
          onPress={() => void submit()}
        />
      </Surface>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  card: { gap: tokens.spacing.lg },
  field: { gap: 7 },
  label: { color: tokens.color.muted, fontSize: tokens.typography.label, fontWeight: '800' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: tokens.color.surface,
    color: tokens.color.ink,
    fontSize: tokens.typography.body,
  },
  error: { color: tokens.color.danger, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
});
