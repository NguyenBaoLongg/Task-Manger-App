import { describe, expect, it } from 'vitest';
import { S3ObjectStorage } from '../../src/modules/media/s3-object-storage.js';

describe('S3-compatible signing adapter', () => {
  it('signs PUT and GET without network access', async () => {
    const storage = new S3ObjectStorage('adsup-test', {
      region: 'ap-southeast-1',
      endpoint: 'https://s3.example.test',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    const upload = await storage.createUploadUrl({
      objectKey: 'tenant-a/media-a',
      contentType: 'image/jpeg',
      byteSize: 100,
      checksumSha256: 'a'.repeat(64),
      expiresInSeconds: 300,
    });
    const download = await storage.createDownloadUrl('tenant-a/media-a', 300);
    expect(upload.url).toContain('X-Amz-Signature');
    expect(download.url).toContain('X-Amz-Signature');
    expect(upload.requiredHeaders['x-amz-meta-sha256']).toBe('a'.repeat(64));
  });
});
