import { getSupportedFields, validateFormData } from '@/forms/form-validation';

describe('dynamic form renderer bridge', () => {
  it('supports required string/number/boolean fields and blocks unsupported schema keywords', () => {
    const schema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        count: { type: 'number' },
        active: { type: 'boolean' },
      },
    };
    expect(getSupportedFields(schema)).toEqual(['name', 'count', 'active']);
    expect(validateFormData(schema, { name: '' }).valid).toBe(false);
    expect(validateFormData(schema, { name: 'Demo', count: 2, active: true }).valid).toBe(true);
    expect(
      validateFormData({ type: 'object', properties: {}, unevaluatedProperties: false }, {}).valid,
    ).toBe(false);
  });

  it('validates the full MVP schema subset and maps server field/form errors', () => {
    const schema = {
      type: 'object',
      title: 'Booking form',
      description: 'Customer intake',
      additionalProperties: false,
      required: ['name', 'age', 'channel'],
      properties: {
        name: { type: 'string', minLength: 2, maxLength: 10, pattern: '^[A-Z]' },
        age: { type: 'integer', minimum: 18, maximum: 70 },
        channel: { type: 'string', enum: ['facebook', 'zalo'] },
        notes: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2 },
      },
    };

    expect(
      validateFormData(schema, {
        name: 'An',
        age: 22,
        channel: 'facebook',
        notes: ['called'],
      }),
    ).toEqual({ valid: true, errors: {} });
    expect(
      validateFormData(schema, {
        name: 'an',
        age: 17.5,
        channel: 'sms',
        extra: true,
        notes: [],
      }).errors,
    ).toMatchObject({
      name: 'PATTERN',
      age: 'INTEGER',
      channel: 'ENUM',
      extra: 'ADDITIONAL_PROPERTY',
      notes: 'MIN_ITEMS',
    });
  });
});
