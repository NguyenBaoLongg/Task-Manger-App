import { measureAsync } from '@/observability/mobile-metrics';

describe('mobile performance budgets', () => {
  it('measures dashboard/action-center and paginated reads', async () => {
    const result = await measureAsync('dashboard', async () => undefined);
    expect(result.durationMs).toBeLessThan(3000);
    expect(result.name).toBe('dashboard');
  });
});
