import { describe, expect, it } from 'vitest';
import { MediaService, redactMediaForLog } from '../../src/modules/media/media-service.js';

describe('booking retention privacy', () => {
  it('denies download after tombstone and redacts object credentials', async () => {
    const service = new MediaService(
      {
        get: async () => ({
          tenantId: 'tenant-1',
          id: 'media-1',
          ownerMembershipId: 'member-1',
          branchId: 'branch-1',
          status: 'DELETED',
        }),
      } as never,
      {
        createDownloadUrl: async () => ({
          url: 'memory://should-not-be-used',
          expiresAt: new Date(),
        }),
      } as never,
      'bucket',
      300,
    );
    await expect(service.download('tenant-1', 'media-1', 'member-1')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(
      redactMediaForLog({
        objectKey: 'secret/key',
        bucket: 'private',
        checksum: 'abc',
        safe: 'ok',
      }),
    ).toEqual({ safe: 'ok' });
  });
});
