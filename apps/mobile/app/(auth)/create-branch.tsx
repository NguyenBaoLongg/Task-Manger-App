import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppButton, ScreenFrame, Surface } from '@/components/ui/ScreenPrimitives';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import {
  createBranch,
  freshCreateBranchIdempotencyKey,
  CreateBranchError,
} from '@/features/tenant/create-branch-model';
import { tokens } from '@/theme/tokens';

const BRANCH_CODE_PATTERN = /^[A-Z0-9_-]{2,32}$/;

export default function CreateBranchScreen() {
  const { tenantId } = useLocalSearchParams<{ tenantId: string }>();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const pendingRef = useRef<{ key: string; code: string; name: string } | undefined>(undefined);
  const busyRef = useRef(false);

  const submit = async () => {
    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    if (!tenantId || !trimmedName || !BRANCH_CODE_PATTERN.test(trimmedCode) || busyRef.current) return;
    let pending = pendingRef.current;
    if (!pending || pending.code !== trimmedCode || pending.name !== trimmedName) {
      pending = { code: trimmedCode, name: trimmedName, key: freshCreateBranchIdempotencyKey() };
      pendingRef.current = pending;
    }
    busyRef.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const client = await getAuthenticatedClient();
      await createBranch(
        client,
        tenantId,
        { code: trimmedCode, name: trimmedName },
        { idempotencyKey: pending.key },
      );
      pendingRef.current = undefined;
      router.back();
    } catch (caught) {
      if (caught instanceof CreateBranchError) {
        setError(caught.message);
        if (caught.kind !== 'network') pendingRef.current = undefined;
      } else {
        setError('Không thể tạo cơ sở. Hãy thử lại.');
        pendingRef.current = undefined;
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const canSubmit =
    BRANCH_CODE_PATTERN.test(code.trim().toUpperCase()) && name.trim().length >= 2 && !busy;

  return (
    <ScreenFrame
      testID="create-branch.screen"
      eyebrow="PHẠM VI LÀM VIỆC"
      title="Tạo cơ sở"
      subtitle="Mỗi cơ sở là một phạm vi dữ liệu riêng trong công ty."
    >
      <Surface style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>MÃ CƠ SỞ</Text>
          <TextInput
            testID="create-branch.code"
            accessibilityLabel="Mã cơ sở"
            value={code}
            onChangeText={(value) => setCode(value.toUpperCase())}
            placeholder="VD: CN1"
            placeholderTextColor={tokens.color.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>TÊN CƠ SỞ</Text>
          <TextInput
            testID="create-branch.name"
            accessibilityLabel="Tên cơ sở"
            value={name}
            onChangeText={setName}
            placeholder="Nhập tên cơ sở"
            placeholderTextColor={tokens.color.muted}
            style={styles.input}
          />
        </View>
        {error ? (
          <Text testID="create-branch.error" accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <AppButton
          testID="create-branch.submit"
          label={busy ? 'Đang xử lý...' : 'Tạo cơ sở'}
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
