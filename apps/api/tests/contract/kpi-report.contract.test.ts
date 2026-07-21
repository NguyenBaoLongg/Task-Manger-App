import { describe, expect, it } from 'vitest';
import { createReportRevisionSchema, loadKpiOpenApiDocument } from '@adsup/contracts';

describe('daily KPI report contract', () => {
  it('publishes revision, progress and personal action-item operations with cursors', async () => {
    const document = await loadKpiOpenApiDocument();
    const text = JSON.stringify(document);
    for (const operationId of [
      'listDailyKpiReportRevisions',
      'createDailyKpiReportRevision',
      'getMyDailyKpiProgress',
      'listMyActionItems',
    ])
      expect(text).toContain(`"operationId":"${operationId}"`);
    expect(text).toContain('cursor');
  });

  it('accepts only a UUID source submission and optional reason', () => {
    expect(createReportRevisionSchema.safeParse({ formSubmissionId: 'bad' }).success).toBe(false);
    expect(
      createReportRevisionSchema.safeParse({
        formSubmissionId: '10000000-0000-4000-8000-000000000001',
        reason: 'Báo cáo cập nhật',
      }).success,
    ).toBe(true);
  });
});
