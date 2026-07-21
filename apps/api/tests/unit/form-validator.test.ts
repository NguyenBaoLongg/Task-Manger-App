import { describe, expect, it } from 'vitest';
import { FormValidator } from '../../src/modules/forms/form-validator.js';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  required: ['value'],
  properties: { value: { type: 'number' }, evidence: { type: 'string' } },
};
describe('dynamic form validator', () => {
  it('accepts the MVP field vocabulary and returns field paths', () => {
    const validator = new FormValidator();
    const compiled = validator.compile(schema);
    validator.validate(compiled, { value: 2, evidence: 'ok' });
    expect(() => validator.validate(compiled, { value: 'bad' })).toThrow();
  });
  it('rejects remote references', () =>
    expect(() =>
      new FormValidator().compile({ ...schema, $ref: 'https://example.test/schema' }),
    ).toThrow());
});
