import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ApiProblemError } from '@/api/problem';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { tokens } from '@/theme/tokens';
import { createApiClient } from '@/api/api-client';
import { getRuntimeConfig } from '@/config/runtime-config';
import { createGoogleProvider } from '@/auth/provider-factory';
import { signInWithProvider } from '@/features/auth/sign-in-model';
import { saveSession } from '@/features/auth/session-runtime';
import { markSignInActionable } from '@/native/adsup-runtime';

export default function SignInScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const markedActionableRef = useRef(false);

  useEffect(() => {
    if (markedActionableRef.current) return;
    markedActionableRef.current = true;
    void markSignInActionable();
  }, []);

  const signIn = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const provider = createGoogleProvider();
      const client = createApiClient({
        baseUrl: getRuntimeConfig().apiBaseUrl,
        getAccessToken: () => undefined,
      });
      const result = await signInWithProvider(
        provider,
        client,
        `mobile-sign-in-${Date.now()}`,
      );
      if (result === 'cancelled') return;
      await saveSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
      });
      router.replace(
        result.profileComplete ? '/(auth)/workspace-selection' : '/(auth)/profile-confirmation',
      );
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes('EXPO_PUBLIC_GOOGLE_CLIENT_ID')) {
        setError(caught.message);
      } else if (caught instanceof ApiProblemError) {
        setError(
          caught.status === 403
            ? 'Tài khoản đã bị khóa. Hãy liên hệ quản trị viên công ty.'
            : caught.status === 401
              ? 'Google không xác nhận được tài khoản. Hãy thử lại.'
              : `Đăng nhập thất bại (${caught.code}). Hãy thử lại.`,
        );
      } else if (caught instanceof Error) {
        const code = (caught as { code?: unknown }).code;
        const codeText =
          typeof code === 'string' ? code : code == null ? '' : JSON.stringify(code);
        setError(
          `Đăng nhập thất bại${codeText ? ` (${codeText})` : ''}: ${caught.message || 'lỗi không xác định'}.`,
        );
      } else {
        setError('Không thể kết nối máy chủ. Hãy kiểm tra kết nối mạng rồi thử lại.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.brand}>
          <BrandLogo size={76} />
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>ADSUP</Text>
            <Text style={styles.brandCaption}>Agency CRM</Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.eyebrow}>ĐĂNG NHẬP</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Chào mừng trở lại
          </Text>
          <Text style={styles.body}>Tiếp tục vào workspace được cấp quyền của bạn.</Text>

          <View style={styles.scopeRow}>
            <View style={styles.scopeIcon}>
              <Ionicons name="shield-checkmark-outline" size={22} color={tokens.color.primary} />
            </View>
            <Text style={styles.scopeText}>Dữ liệu theo đúng công ty, cơ sở và vai trò.</Text>
          </View>
        </View>

        <View style={styles.actionArea}>
          <Pressable
            testID="auth.sign-in"
            accessibilityRole="button"
            accessibilityLabel="Đăng nhập bằng Google"
            accessibilityState={{ disabled: busy }}
            style={({ pressed }) => [
              styles.button,
              pressed && !busy && styles.buttonPressed,
              busy && styles.buttonDisabled,
            ]}
            disabled={busy}
            onPress={() => void signIn()}
          >
            <Ionicons name="logo-google" size={21} color={tokens.color.inkInverted} />
            <Text style={styles.buttonText}>
              {busy ? 'Đang kết nối...' : 'Đăng nhập bằng Google'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color={tokens.color.inkInverted} />
          </Pressable>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tokens.color.canvas },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
  brandCopy: { gap: 2 },
  brandName: { color: tokens.color.ink, fontSize: 22, fontWeight: '900' },
  brandCaption: { color: tokens.color.primary, fontSize: 14, fontWeight: '700' },
  content: { gap: tokens.spacing.md },
  eyebrow: { color: tokens.color.primary, fontSize: tokens.typography.label, fontWeight: '800' },
  title: { color: tokens.color.ink, fontSize: 32, lineHeight: 38, fontWeight: '800' },
  body: { color: tokens.color.muted, fontSize: tokens.typography.body, lineHeight: 24 },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.md,
  },
  scopeIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.primarySoft,
  },
  scopeText: {
    flex: 1,
    color: tokens.color.ink,
    fontSize: tokens.typography.bodySmall,
    lineHeight: 20,
    fontWeight: '600',
  },
  actionArea: { gap: tokens.spacing.md },
  button: {
    minHeight: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: tokens.color.primary,
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.lg,
  },
  buttonPressed: { backgroundColor: tokens.color.primaryPressed },
  buttonDisabled: { opacity: 0.55 },
  buttonText: {
    color: tokens.color.inkInverted,
    fontSize: tokens.typography.body,
    fontWeight: '800',
  },
  error: { color: tokens.color.danger, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
});
