type FieldSchema = {
  type?: string;
  title?: string;
  description?: string;
  enum?: unknown[];
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  items?: { type?: string };
  minItems?: number;
  maxItems?: number;
  [key: string]: unknown;
};

type Schema = {
  type?: string;
  title?: string;
  description?: string;
  required?: string[];
  additionalProperties?: boolean;
  properties?: Record<string, FieldSchema>;
  [key: string]: unknown;
};

const supportedRootKeys = new Set([
  'type',
  'title',
  'description',
  'required',
  'additionalProperties',
  'properties',
]);

const supportedFieldKeys = new Set([
  'type',
  'title',
  'description',
  'enum',
  'format',
  'pattern',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'items',
  'minItems',
  'maxItems',
]);

const unsupportedSchema = (schema: Schema) => {
  if (Object.keys(schema).some((key) => !supportedRootKeys.has(key))) return true;
  return Object.values(schema.properties ?? {}).some((definition) =>
    Object.keys(definition).some((key) => !supportedFieldKeys.has(key)),
  );
};

const empty = (value: unknown) => value === undefined || value === null || value === '';

export const getSupportedFields = (schema: Schema) => Object.keys(schema.properties ?? {});

export const mapServerValidationErrors = (
  errors: Array<{ field?: string; code?: string; message?: string }> | Record<string, string>,
) => {
  if (!Array.isArray(errors)) return errors;
  return errors.reduce<Record<string, string>>((mapped, item) => {
    mapped[item.field ?? 'form'] = item.code ?? item.message ?? 'INVALID';
    return mapped;
  }, {});
};

export const validateFormData = (schema: Schema, data: Record<string, unknown>) => {
  if (unsupportedSchema(schema)) return { valid: false, errors: { form: 'UNSUPPORTED_SCHEMA' } };
  const errors: Record<string, string> = {};

  for (const field of schema.required ?? []) if (empty(data[field])) errors[field] = 'REQUIRED';

  if (schema.additionalProperties === false) {
    for (const field of Object.keys(data))
      if (!schema.properties?.[field]) errors[field] = 'ADDITIONAL_PROPERTY';
  }

  for (const [field, definition] of Object.entries(schema.properties ?? {})) {
    const value = data[field];
    if (empty(value)) continue;
    if (definition.enum && !definition.enum.includes(value)) {
      errors[field] = 'ENUM';
      continue;
    }
    if (definition.type === 'string') {
      if (typeof value !== 'string') {
        errors[field] = 'TYPE';
      } else if (definition.minLength !== undefined && value.length < definition.minLength) {
        errors[field] = 'MIN_LENGTH';
      } else if (definition.maxLength !== undefined && value.length > definition.maxLength) {
        errors[field] = 'MAX_LENGTH';
      } else if (definition.pattern && !new RegExp(definition.pattern).test(value)) {
        errors[field] = 'PATTERN';
      }
    }
    if (definition.type === 'number' || definition.type === 'integer') {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        errors[field] = definition.type === 'integer' ? 'INTEGER' : 'TYPE';
      } else if (definition.type === 'integer' && !Number.isInteger(value)) {
        errors[field] = 'INTEGER';
      } else if (definition.minimum !== undefined && value < definition.minimum) {
        errors[field] = 'MINIMUM';
      } else if (definition.maximum !== undefined && value > definition.maximum) {
        errors[field] = 'MAXIMUM';
      }
    }
    if (definition.type === 'boolean' && typeof value !== 'boolean') errors[field] = 'TYPE';
    if (definition.type === 'array') {
      if (!Array.isArray(value)) {
        errors[field] = 'TYPE';
      } else if (definition.minItems !== undefined && value.length < definition.minItems) {
        errors[field] = 'MIN_ITEMS';
      } else if (definition.maxItems !== undefined && value.length > definition.maxItems) {
        errors[field] = 'MAX_ITEMS';
      } else if (definition.items?.type) {
        const invalidItem = value.some((item) => {
          if (definition.items?.type === 'integer')
            return typeof item !== 'number' || !Number.isInteger(item);
          if (definition.items?.type === 'array') return !Array.isArray(item);
          return typeof item !== definition.items?.type;
        });
        if (invalidItem) errors[field] = 'ITEM_TYPE';
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
};
