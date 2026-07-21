import { describe, expect, it } from 'vitest';
import { loadKpiOpenApiDocument, penaltyAdjustmentSchema } from '@adsup/contracts';

describe('KPI management contract', () => {
  it('publishes scoped manager feed and append-only penalty adjustment', async () => {
    const document = await loadKpiOpenApiDocument();
    const text = JSON.stringify(document);
    expect(text).toContain('"operationId":"listManagedActionItems"');
    expect(text).toContain('"operationId":"createKpiPenaltyAdjustment"');
    expect(text).toContain('branchId');
  });

  it('requires a signed integer delta and reason', () => {
    expect(
      penaltyAdjustmentSchema.safeParse({ deltaMinor: '-100000', reason: 'Hoàn tiền phạt' })
        .success,
    ).toBe(true);
    expect(penaltyAdjustmentSchema.safeParse({ deltaMinor: 100, reason: 'x' }).success).toBe(false);
  });
});
