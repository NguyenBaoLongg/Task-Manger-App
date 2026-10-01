import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { MemoryObjectStorage } from '../../src/modules/media/s3-object-storage.js';
import { dependencies, send } from './published-http.contract.test.js';

const checksum = 'a'.repeat(64);

const pendingMedia = {
  objectKey: 'tenant-1/chat/voice.m4a',
  contentType: 'audio/mp4',
  byteSize: 4n,
  checksumSha256: checksum,
  status: 'PENDING_UPLOAD',
  uploadExpiresAt: new Date(Date.now() + 60_000),
};

describe('dev storage PUT contract', () => {
  it('stores a PUT that matches the signed intent and rejects mismatches', async () => {
    const storage = new MemoryObjectStorage('http://127.0.0.1:3000');
    const app = createApp(
      dependencies({
        devStorage: {
          storage,
          findPendingMediaByObjectKey: async (objectKey) =>
            objectKey === pendingMedia.objectKey ? pendingMedia : null,
        },
      }),
    );

    const encoded = encodeURIComponent(pendingMedia.objectKey);
    await send(app, 'put', `/dev-storage/${encoded}`)
      .set('Content-Type', 'audio/mp4')
      .set('x-checksum-sha256', 'b'.repeat(64))
      .send(Buffer.from([1, 2, 3, 4]))
      .expect(422);
    await send(app, 'put', `/dev-storage/${encoded}`)
      .set('Content-Type', 'audio/mp4')
      .set('x-checksum-sha256', checksum)
      .send(Buffer.from([1, 2, 3]))
      .expect(422);
    await send(app, 'put', `/dev-storage/${encodeURIComponent('tenant-1/chat/none.m4a')}`)
      .set('Content-Type', 'audio/mp4')
      .set('x-checksum-sha256', checksum)
      .send(Buffer.from([1, 2, 3, 4]))
      .expect(404);

    await send(app, 'put', `/dev-storage/${encoded}`)
      .set('Content-Type', 'audio/mp4')
      .set('x-checksum-sha256', checksum)
      .send(Buffer.from([1, 2, 3, 4]))
      .expect(200);
    expect(await storage.head(pendingMedia.objectKey)).toEqual({
      contentType: 'audio/mp4',
      byteSize: 4,
      checksumSha256: checksum,
    });

    const downloaded = await send(app, 'get', `/dev-storage/${encoded}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(downloaded.headers['content-type']).toContain('audio/mp4');
    expect(Buffer.from(downloaded.body)).toEqual(Buffer.from([1, 2, 3, 4]));
    await send(app, 'get', `/dev-storage/${encodeURIComponent('tenant-1/chat/none.m4a')}`).expect(
      404,
    );
  });

  it('hands clients a reachable download url only when the base url is configured', async () => {
    const storage = new MemoryObjectStorage('http://127.0.0.1:3000');
    const download = await storage.createDownloadUrl('tenant-1/chat/voice.m4a', 60);
    expect(download.url).toBe('http://127.0.0.1:3000/dev-storage/tenant-1%2Fchat%2Fvoice.m4a');

    const fallback = new MemoryObjectStorage();
    const legacy = await fallback.createDownloadUrl('tenant-1/chat/voice.m4a', 60);
    expect(legacy.url.startsWith('memory://')).toBe(true);
  });

  it('hands clients a reachable upload url only when the base url is configured', async () => {
    const storage = new MemoryObjectStorage('http://127.0.0.1:3000');
    const url = await storage.createUploadUrl({
      objectKey: 'tenant-1/chat/voice.m4a',
      contentType: 'audio/mp4',
      byteSize: 1,
      checksumSha256: checksum,
      expiresInSeconds: 60,
    });
    expect(url.url).toBe(
      'http://127.0.0.1:3000/dev-storage/tenant-1%2Fchat%2Fvoice.m4a',
    );

    const fallback = new MemoryObjectStorage();
    const legacy = await fallback.createUploadUrl({
      objectKey: 'tenant-1/chat/voice.m4a',
      contentType: 'audio/mp4',
      byteSize: 1,
      checksumSha256: checksum,
      expiresInSeconds: 60,
    });
    expect(legacy.url.startsWith('memory://')).toBe(true);
  });
});
