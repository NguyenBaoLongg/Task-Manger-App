import { describe, expect, it } from 'vitest';
import { VideoConversionRunner } from '../../src/attendance/video-conversion-runner.js';

describe('attendance video conversion runner', () => {
  it('marks retryable failures without duplicating processed assets', async () => {
    const seen = new Set<string>();
    const repository = {
      async listPendingVideoAssets() {
        return [{ tenantId: 't1', id: 'asset-1', attemptCount: 0 }];
      },
      async markVideoConversionFailed(input: { id: string }) {
        seen.add(input.id);
      },
    };
    const runner = new VideoConversionRunner(repository, {
      async convert() {
        throw new Error('codec secret detail');
      },
    });
    await expect(runner.runTenant('t1')).resolves.toEqual({ processed: 1, ready: 0, failed: 1 });
    await expect(runner.runTenant('t1')).resolves.toEqual({ processed: 1, ready: 0, failed: 1 });
    expect(seen.size).toBe(1);
  });
});
