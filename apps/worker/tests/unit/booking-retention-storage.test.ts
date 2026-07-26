import { describe, expect, it, vi } from 'vitest';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import {
  LocalRetentionObjectStorage,
  S3RetentionObjectStorage,
  createBookingRetentionObjectStorage,
} from '../../src/storage/booking-retention-storage.ts';

describe('booking retention object storage', () => {
  it('deletes through S3 with the configured bucket and tenant-scoped key', async () => {
    const send = vi.fn(async (_command: DeleteObjectCommand) => ({}));
    const storage = new S3RetentionObjectStorage(
      'booking-bucket',
      { region: 'ap-southeast-1', endpoint: 'http://localhost:9000' },
      { send },
    );

    await storage.delete({ tenantId: 'tenant-a', objectKey: 'tenant-a/media-1' });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(DeleteObjectCommand);
    expect((send.mock.calls[0]?.[0] as DeleteObjectCommand).input).toMatchObject({
      Bucket: 'booking-bucket',
      Key: 'tenant-a/media-1',
    });
  });

  it('rejects a retention delete for another tenant before touching storage', async () => {
    const send = vi.fn(async (_command: DeleteObjectCommand) => ({}));
    const storage = new S3RetentionObjectStorage('booking-bucket', { region: 'test' }, { send });

    await expect(
      storage.delete({ tenantId: 'tenant-a', objectKey: 'tenant-b/media-1' }),
    ).rejects.toThrow('BOOKING_OBJECT_SCOPE_VIOLATION');
    expect(send).not.toHaveBeenCalled();
  });

  it('uses the local adapter for memory/local configuration and preserves tenant scope', async () => {
    const storage = createBookingRetentionObjectStorage({
      objectStorageDriver: 'memory',
      s3: { region: 'test', bucket: '' },
      localRoot: '.data/test-retention',
    });

    expect(storage).toBeInstanceOf(LocalRetentionObjectStorage);
    await expect(
      storage.delete({ tenantId: 'tenant-a', objectKey: 'tenant-b/media-1' }),
    ).rejects.toThrow('BOOKING_OBJECT_SCOPE_VIOLATION');
  });
});
