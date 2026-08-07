import { StyleSheet, Text, TextInput, View } from 'react-native';
import { tokens } from '@/theme/tokens';
import { getSupportedFields } from './form-validation';

type RenderableSchema = Parameters<typeof getSupportedFields>[0] & {
  properties?: Record<
    string,
    { title?: string; description?: string; enum?: unknown[]; type?: string }
  >;
};

export const JsonSchemaRenderer = ({
  schema,
  values,
  onChange,
  errors = {},
}: {
  schema: Record<string, unknown>;
  values: Record<string, unknown>;
  onChange: (field: string, value: string) => void;
  errors?: Record<string, string>;
}) => {
  const typedSchema = schema as RenderableSchema;

  return (
    <View style={styles.container}>
      {errors.form ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {errors.form}
        </Text>
      ) : null}
      {getSupportedFields(typedSchema).map((field) => {
        const definition = typedSchema.properties?.[field];
        const value = values[field];
        const text =
          typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
            ? String(value)
            : '';
        return (
          <View key={field} style={styles.field}>
            <Text style={styles.label}>{definition?.title ?? field}</Text>
            {definition?.description ? (
              <Text style={styles.description}>{definition.description}</Text>
            ) : null}
            <TextInput
              accessibilityLabel={definition?.title ?? field}
              value={text}
              onChangeText={(next) => onChange(field, next)}
              placeholder={
                definition?.enum ? `One of: ${definition.enum.join(', ')}` : 'Enter value'
              }
              placeholderTextColor={tokens.color.muted}
              keyboardType={
                definition?.type === 'number' || definition?.type === 'integer'
                  ? 'numeric'
                  : 'default'
              }
              style={[styles.input, errors[field] && styles.inputInvalid]}
            />
            {errors[field] ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {errors[field]}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: tokens.spacing.md },
  field: { gap: 7 },
  label: { color: tokens.color.ink, fontSize: tokens.typography.bodySmall, fontWeight: '800' },
  description: { color: tokens.color.muted, fontSize: tokens.typography.label, lineHeight: 17 },
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
  inputInvalid: { borderColor: tokens.color.danger },
  error: { color: tokens.color.danger, fontSize: tokens.typography.bodySmall, lineHeight: 19 },
});
