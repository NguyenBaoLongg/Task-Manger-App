import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton, ScreenFrame, Surface } from '@/components/ui/ScreenPrimitives';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import {
  acceptInvitation,
  freshJoinIdempotencyKey,
  JoinError,
} from '@/features/members/join-model';
import { tokens } from '@/theme/tokens';

export default function JoinCompanyScreen() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const pendingRef = useRef<{ key: string; code: string } | undefined>(undefined);
  const busyRef = useRef(false);

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed || busyRef.current) return;
    let pending = pendingRef.current;
    if (!pending || pending.code !== trimmed) {
      pending = { code: trimmed, key: freshJoinIdempotencyKey() };
      pendingRef.current = pending;
    }
    busyRef.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const client = await getAuthenticatedClient();
      const outcome = await acceptInvitation(client, trimmed, {
        idempotencyKey: pending.key,
      });
      if (outcome.kind === 'joined') {
        pendingRef.current = undefined;
        router.replace('/(auth)/workspace-selection');
        return;
      }
      router.push({
        pathname: '/(auth)/profile-confirmation',
        params: { pendingJoinToken: trimmed, pendingJoinKey: pending.key },
      });
    } catch (caught) {
      if (caught instanceof JoinError) {
        setError(caught.message);
        if (caught.kind !== 'network') pendingRef.current = undefined;
      } else {
        setError('Không thể tham gia công ty. Hãy thử lại.');
        pendingRef.current = undefined;
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const canSubmit = code.trim().length > 0 && !busy;

  return (
    <ScreenFrame
      testID="join-company.screen"
      eyebrow="ADSUP / JOIN"
      title="Tham gia công ty"
      subtitle="Nhập mã lời mời bạn nhận được từ công ty để bắt đầu làm việc."
    >
      <Surface style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>MÃ LỜI MỜI</Text>
          <TextInput
            testID="join-company.code"
            accessibilityLabel="Mã lời mời"
            value={code}
            onChangeText={setCode}
            placeholder="Nhập mã lời mời"
            placeholderTextColor={tokens.color.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>
        {error ? (
          <Text testID="join-company.error" accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <AppButton
          testID="join-company.submit"
          label={busy ? 'Đang xử lý...' : 'Tham gia'}
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
