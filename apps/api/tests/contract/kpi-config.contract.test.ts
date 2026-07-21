import { describe, expect, it } from 'vitest';
import {
  bulkPolicySchema,
  createKpiDefinitionSchema,
  createSourceMappingSchema,
  createTargetVersionSchema,
  loadKpiOpenApiDocument,
} from '@adsup/contracts';

describe('KPI configuration contract', () => {
  it('publishes every configuration operation', async () => {
    const document = await loadKpiOpenApiDocument();
    const text = JSON.stringify(document);
    for (const operationId of [
      'listKpiDefinitions',
      'createKpiDefinition',
      'createKpiTargetVersion',
      'createKpiSourceMappingVersion',
      'bulkCreateDailyKpiPolicyVersions',
      'getEffectiveDailyKpiPolicy',
    ]) {
      expect(text).toContain(`"operationId":"${operationId}"`);
    }
  });

  it('rejects malformed exact values, source mappings and policy times', () => {
    expect(() => createKpiDefinitionSchema.parse({ code: 'bad' })).toThrow();
    expect(() =>
      createTargetVersionSchema.parse({ target: { value: '0.1', unit: 'VND' } }),
    ).toThrow();
    expect(() => createSourceMappingSchema.parse({ sourceType: 'DOMAIN_ADAPTER' })).toThrow();
    expect(() =>
      bulkPolicySchema.parse({ reportOpenLocal: '20:00:00', reportCloseLocal: '18:00:00' }),
    ).toThrow();
  });
});
