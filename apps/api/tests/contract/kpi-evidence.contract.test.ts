import { describe, expect, it } from 'vitest';
import { loadKpiOpenApiDocument } from '@adsup/contracts';

describe('KPI evidence contract', () => {
  it('publishes an authenticated refresh endpoint and its error surfaces', async () => {
    const document = await loadKpiOpenApiDocument();
    const text = JSON.stringify(document);
    expect(text).toContain('"operationId":"refreshEvidenceDebt"');
    expect(text).toContain('Unauthorized');
    expect(text).toContain('Forbidden');
    expect(text).toContain('NotFound');
  });
});
