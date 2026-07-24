import { describe, expect, it } from 'vitest';
import { VideoConversionRunner } from '../../src/attendance/video-conversion-runner.js';

describe('attendance video conversion runner', () => {
  it('releases retryable failures without exposing converter details', async () => {
    const seen = new Set<string>();
    let claimed = false;
    const repository = {
      async claimPendingVideoAssets() {
        if (claimed) return [];
        claimed = true;
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
    await expect(runner.runTenant('t1')).resolves.toEqual({ processed: 0, ready: 0, failed: 0 });
    expect(seen.size).toBe(1);
  });

  it('atomically claims an asset so concurrent workers convert it once', async () => {
    let available = true;
    let conversions = 0;
    const repository = {
      async claimPendingVideoAssets() {
        if (!available) return [];
        available = false;
        return [{ tenantId: 't1', id: 'asset-1', attemptCount: 1 }];
      },
      async markVideoConversionReady() {
        return undefined;
      },
      async markVideoConversionFailed() {
        return undefined;
      },
    };
    const converter = {
      async convert() {
        conversions += 1;
        return { convertedMediaObjectId: 'converted-1' };
      },
    };
    const first = new VideoConversionRunner(repository, converter, 'worker-1');
    const second = new VideoConversionRunner(repository, converter, 'worker-2');

    const results = await Promise.all([first.runTenant('t1'), second.runTenant('t1')]);

    expect(results.map((result) => result.processed).sort()).toEqual([0, 1]);
    expect(conversions).toBe(1);
  });
});
