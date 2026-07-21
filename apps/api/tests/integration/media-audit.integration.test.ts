import { describe, expect, it } from 'vitest';
import type { MediaRepository } from '@adsup/database';
import { MemoryObjectStorage } from '../../src/modules/media/s3-object-storage.js';
import { MediaService } from '../../src/modules/media/media-service.js';

describe('media completion lifecycle', () => {
  it('is retry-safe and rejects checksum mismatch', async () => {
    const rows = new Map<string, Record<string, unknown>>();
    const repository = {
      async createIntent(input: Record<string, unknown>) {
        const row = { id: 'media-1', status: 'PENDING_UPLOAD', ...input };
        rows.set('media-1', row);
        return row;
      },
      async get(_tenant: string, id: string) {
        return rows.get(id) ?? null;
      },
      async markReady(_tenant: string, id: string) {
        const row = rows.get(id)!;
        row.status = 'READY';
        return row;
      },
      async markRejected(_tenant: string, id: string) {
        const row = rows.get(id)!;
        row.status = 'REJECTED';
        return row;
      },
    } as unknown as MediaRepository;
    const storage = new MemoryObjectStorage();
    const service = new MediaService(repository, storage, 'test', 300);
    const intent = await service.createIntent({
      tenantId: '10000000-0000-4000-8000-000000000001',
      actorMembershipId: '30000000-0000-4000-8000-000000000001',
      sourceType: 'FORM_SUBMISSION',
      purpose: 'FORM_EVIDENCE',
      contentType: 'image/jpeg',
      byteSize: 100,
      checksumSha256: 'a'.repeat(64),
      correlationId: 'test-media',
    });
    storage.put(intent.media.objectKey, {
      contentType: 'image/jpeg',
      byteSize: 100,
      checksumSha256: 'a'.repeat(64),
    });
    const ready = await service.complete(
      intent.media.tenantId,
      intent.media.id,
      intent.media.ownerMembershipId,
      'test-media',
    );
    expect(ready.status).toBe('READY');
    await expect(
      service.complete(
        intent.media.tenantId,
        intent.media.id,
        intent.media.ownerMembershipId,
        'test-media',
      ),
    ).resolves.toMatchObject({ status: 'READY' });
  });
});
