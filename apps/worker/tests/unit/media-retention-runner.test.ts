import { describe, expect, it } from 'vitest';
import { MediaRetentionRunner } from '../../src/attendance/media-retention-runner.js';

describe('media retention runner', () => {
  it('deletes expired media, creates tombstones and skips legal hold', async () => {
    const tombstoned: string[] = [];
    const deleted: string[] = [];
    const runner = new MediaRetentionRunner(
      {
        async listRetentionCandidates() {
          return [
            { tenantId: 'tenant-1', id: 'media-1', objectKey: 'tenant-1/media-1.mp4' },
            {
              tenantId: 'tenant-1',
              id: 'media-2',
              objectKey: 'tenant-1/media-2.pdf',
              legalHoldAt: new Date('2026-07-01T00:00:00.000Z'),
            },
          ];
        },
        async tombstoneMediaObject(input) {
          tombstoned.push(input.mediaObjectId);
        },
      },
      {
        async delete(objectKey) {
          deleted.push(objectKey);
        },
      },
    );
    await expect(runner.runTenant({ tenantId: 'tenant-1' })).resolves.toEqual({
      processed: 2,
      deleted: 1,
      skippedLegalHold: 1,
      failed: 0,
    });
    expect(deleted).toEqual(['tenant-1/media-1.mp4']);
    expect(tombstoned).toEqual(['media-1']);
  });
});
