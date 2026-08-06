import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type PressableProps,
  type TextInputProps,
} from 'react-native';
import { tokens } from '@/theme/tokens';

export const AccessibleButton = (props: PressableProps & { label: string }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={props.label}
    style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    {...props}
  />
);

export const AccessibleField = (props: TextInputProps & { label: string }) => (
  <TextInput
    accessibilityLabel={props.label}
    placeholderTextColor={tokens.color.muted}
    style={styles.input}
    {...props}
  />
);

export const FieldLabel = ({ children }: { children: string }) => (
  <Text accessibilityRole="text" style={styles.label}>
    {children}
  </Text>
);

const styles = StyleSheet.create({
  button: {
    minHeight: tokens.touchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.primary,
    paddingHorizontal: tokens.spacing.lg,
  },
  buttonPressed: { opacity: 0.82 },
  input: {
    minHeight: tokens.touchTarget,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: tokens.color.surface,
    color: tokens.color.ink,
    fontSize: tokens.typography.body,
  },
  label: { color: tokens.color.muted, fontSize: tokens.typography.label, fontWeight: '800' },
});
