import { describe, expect, it } from 'vitest';
import type { FormsRepository } from '@adsup/database';
import { FormService } from '../../src/modules/forms/form-service.js';
import { FormValidator } from '../../src/modules/forms/form-validator.js';

describe('immutable form version submission', () => {
  it('validates against the exact published version', async () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      required: ['count'],
      properties: { count: { type: 'integer' } },
    };
    const repository = {
      async getTemplate() {
        return { currentPublishedVersionId: 'v1', status: 'ACTIVE' };
      },
      async getVersion() {
        return { id: 'v1', formTemplateId: 'f', status: 'PUBLISHED', jsonSchema: schema };
      },
      async createSubmission(input: unknown) {
        return input;
      },
    } as unknown as FormsRepository;
    const service = new FormService(repository, new FormValidator());
    await expect(
      service.submit({
        tenantId: 't',
        templateId: 'f',
        actorMembershipId: 'm',
        formVersionId: 'v1',
        data: { count: 'wrong' },
        idempotencyKey: 'form-0001',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      service.submit({
        tenantId: 't',
        templateId: 'f',
        actorMembershipId: 'm',
        formVersionId: 'v1',
        data: { count: 1 },
        idempotencyKey: 'form-0002',
      }),
    ).resolves.toMatchObject({ formVersionId: 'v1' });
  });
});
