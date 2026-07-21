import { describe, expect, it } from 'vitest';
import { evaluationRerunSchema, loadKpiOpenApiDocument } from '@adsup/contracts';

describe('daily KPI evaluation contract', () => {
  it('publishes history and idempotent rerun operations', async () => {
    const document = await loadKpiOpenApiDocument();
    const text = JSON.stringify(document);
    expect(text).toContain('"operationId":"listDailyKpiEvaluations"');
    expect(text).toContain('"operationId":"enqueueDailyKpiEvaluationRerun"');
    expect(text).toContain('Idempotency-Key');
  });

  it('bounds rerun scope and requires an audit reason', () => {
    expect(evaluationRerunSchema.safeParse({}).success).toBe(false);
    expect(evaluationRerunSchema.safeParse({ reason: 'Đánh giá lại' }).success).toBe(true);
    expect(
      evaluationRerunSchema.safeParse({
        reason: 'Đánh giá lại',
        membershipIds: Array.from({ length: 10_001 }, () => '10000000-0000-4000-8000-000000000001'),
      }).success,
    ).toBe(false);
  });
});
