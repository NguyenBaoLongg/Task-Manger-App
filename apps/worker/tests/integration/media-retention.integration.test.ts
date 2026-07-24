import { describe, expect, it } from 'vitest';
import { MediaRetentionRunner } from '../../src/attendance/media-retention-runner.js';

describe('media retention integration harness', () => {
  it('deletes and tombstones only expired tenant media while preserving legal hold', async () => {
    const media = [
      {
        tenantId: 'tenant-1',
        id: 'video-1',
        objectKey: 'tenant-1/video-1.mp4',
        expired: true,
        legalHoldAt: null,
        tombstoned: false,
      },
      {
        tenantId: 'tenant-1',
        id: 'evidence-1',
        objectKey: 'tenant-1/evidence-1.jpg',
        expired: true,
        legalHoldAt: new Date('2026-07-01T00:00:00.000Z'),
        tombstoned: false,
      },
      {
        tenantId: 'tenant-2',
        id: 'payment-proof-2',
        objectKey: 'tenant-2/payment-proof-2.jpg',
        expired: true,
        legalHoldAt: null,
        tombstoned: false,
      },
    ];
    const deletedKeys: string[] = [];
    const repository = {
      async listRetentionCandidates(tenantId: string) {
        return media.filter(
          (item) => item.tenantId === tenantId && item.expired && !item.tombstoned,
        );
      },
      async tombstoneMediaObject(input: { tenantId: string; mediaObjectId: string }) {
        const item = media.find(
          (candidate) =>
            candidate.tenantId === input.tenantId && candidate.id === input.mediaObjectId,
        );
        if (item) item.tombstoned = true;
      },
    };
    const runner = new MediaRetentionRunner(repository, {
      async delete(objectKey) {
        deletedKeys.push(objectKey);
      },
    });

    await expect(
      runner.runTenant({
        tenantId: 'tenant-1',
        now: new Date('2026-07-24T00:00:00.000Z'),
      }),
    ).resolves.toEqual({
      processed: 2,
      deleted: 1,
      skippedLegalHold: 1,
      failed: 0,
    });
    expect(deletedKeys).toEqual(['tenant-1/video-1.mp4']);
    expect(media.find((item) => item.id === 'video-1')?.tombstoned).toBe(true);
    expect(media.find((item) => item.id === 'evidence-1')?.tombstoned).toBe(false);
    expect(media.find((item) => item.id === 'payment-proof-2')?.tombstoned).toBe(false);

    await expect(runner.runTenant({ tenantId: 'tenant-1' })).resolves.toMatchObject({
      deleted: 0,
      skippedLegalHold: 1,
    });
  });
});
