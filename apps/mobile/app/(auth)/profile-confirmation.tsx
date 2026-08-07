import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { validateProfileName } from '@/features/auth/profile-confirmation';
import { confirmProfile } from '@/features/auth/profile-confirmation';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { AppButton, ScreenFrame, Surface } from '@/components/ui/ScreenPrimitives';
import { tokens } from '@/theme/tokens';

export default function ProfileConfirmationScreen() {
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string>();

  const submit = async () => {
    try {
      const value = validateProfileName(fullName);
      const client = await getAuthenticatedClient();
      await confirmProfile(client, value, `profile-confirm-${Date.now()}`);
      router.replace('/(auth)/workspace-selection');
    } catch {
      setError('Vui lòng nhập họ và tên.');
    }
  };

  return (
    <ScreenFrame
      eyebrow="ADSUP / PROFILE"
      title="Xác nhận hồ sơ"
      subtitle="Tên hiển thị sẽ dùng trong workspace, audit log và các bản ghi nghiệp vụ."
    >
      <Surface style={styles.card}>
        <View style={styles.brandRow}>
          <BrandLogo size={56} />
          <View style={styles.brandCopy}>
            <Text style={styles.brandTitle}>ADSUP Agency CRM</Text>
            <Text style={styles.brandBody}>Hoàn tất hồ sơ trước khi vào workspace.</Text>
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>HỌ VÀ TÊN</Text>
          <TextInput
            accessibilityLabel="Họ và tên"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Nhập họ và tên"
            placeholderTextColor={tokens.color.muted}
            style={styles.input}
          />
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <AppButton
          label="Xác nhận"
          onPress={() => void submit()}
          disabled={fullName.trim().length < 2}
        />
      </Surface>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  card: { gap: tokens.spacing.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
  brandCopy: { flex: 1, gap: 4 },
  brandTitle: { color: tokens.color.ink, fontSize: tokens.typography.body, fontWeight: '900' },
  brandBody: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
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
  error: { color: tokens.color.danger, fontSize: tokens.typography.bodySmall },
});
