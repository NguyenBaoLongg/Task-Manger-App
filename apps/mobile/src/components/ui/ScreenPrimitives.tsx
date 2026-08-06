import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { tokens } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-provider';

type ScreenFrameProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  testID?: string;
  children: ReactNode;
};

export const ScreenFrame = ({ eyebrow, title, subtitle, testID, children }: ScreenFrameProps) => {
  const theme = useAppTheme();
  return (
    <SafeAreaView
      testID={testID}
      style={[styles.safeArea, { backgroundColor: theme.color.canvas }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {eyebrow ? (
            <Text style={[styles.eyebrow, { color: theme.color.primary }]}>{eyebrow}</Text>
          ) : null}
          <Text accessibilityRole="header" style={[styles.title, { color: theme.color.ink }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.color.muted }]}>{subtitle}</Text>
          ) : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
};

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
  testID?: string;
};

export const AppButton = ({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  testID,
}: AppButtonProps) => {
  const theme = useAppTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.color.primary },
        variant === 'secondary' && [
          styles.buttonSecondary,
          { backgroundColor: theme.color.surface, borderColor: theme.color.border },
        ],
        variant === 'quiet' && styles.buttonQuiet,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          { color: theme.color.inkInverted },
          variant === 'secondary' && { color: theme.color.primary },
          variant === 'quiet' && { color: theme.color.muted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

export const Surface = ({
  children,
  style,
  accessibilityLabel,
  testID,
}: {
  children: ReactNode;
  style?: object;
  accessibilityLabel?: string;
  testID?: string;
}) => {
  const theme = useAppTheme();
  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.surface,
        { backgroundColor: theme.color.surface, borderColor: theme.color.border },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export const SectionHeading = ({ title, detail }: { title: string; detail?: string }) => (
  <View style={styles.sectionHeading}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
  </View>
);

export const StatusPill = ({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) => (
  <View style={[styles.pill, styles[`pill_${tone}`]]}>
    <Text style={[styles.pillText, styles[`pillText_${tone}`]]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tokens.color.canvas },
  scrollContent: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: tokens.spacing.lg,
    paddingBottom: 32,
    gap: tokens.spacing.xl,
  },
  header: { gap: tokens.spacing.xs },
  eyebrow: { color: tokens.color.primary, fontSize: tokens.typography.label, fontWeight: '800' },
  title: { color: tokens.color.ink, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  subtitle: { color: tokens.color.muted, fontSize: tokens.typography.body, lineHeight: 23 },
  surface: {
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
  },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { color: tokens.color.ink, fontSize: tokens.typography.heading, fontWeight: '800' },
  sectionDetail: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall },
  button: {
    minHeight: 52,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.color.primary,
  },
  buttonSecondary: {
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  buttonQuiet: { backgroundColor: 'transparent', minHeight: tokens.touchTarget },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: {
    color: tokens.color.inkInverted,
    fontSize: tokens.typography.body,
    fontWeight: '800',
  },
  buttonTextSecondary: { color: tokens.color.primary },
  buttonTextQuiet: { color: tokens.color.muted },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pill_neutral: { backgroundColor: tokens.color.canvas },
  pill_success: { backgroundColor: tokens.color.successSoft },
  pill_warning: { backgroundColor: tokens.color.warningSoft },
  pill_danger: { backgroundColor: tokens.color.dangerSoft },
  pill_info: { backgroundColor: tokens.color.infoSoft },
  pillText: { fontSize: tokens.typography.label, fontWeight: '800' },
  pillText_neutral: { color: tokens.color.muted },
  pillText_success: { color: tokens.color.success },
  pillText_warning: { color: tokens.color.accent },
  pillText_danger: { color: tokens.color.danger },
  pillText_info: { color: tokens.color.info },
});
