import { describe, expect, it } from 'vitest';
import { redact } from '../../packages/domain/src/index.js';
import { redactMediaForLog } from '../../apps/api/src/modules/media/media-service.js';
import { LocalExportDownloadStorage } from '../../apps/api/src/modules/bookings/export-local-storage.js';

describe('booking media and export security redaction', () => {
  it('removes PII, credentials, signed URLs and object identifiers from logs', () => {
    const redacted = redact({
      authorization: 'Bearer secret',
      signedUrl: 'https://private.example/download',
      objectKey: 'tenant-1/exports/private.xlsx',
      customerName: 'Hidden customer',
      safeState: 'DELETED',
    }) as Record<string, unknown>;
    expect(redacted.authorization).toBe('[REDACTED]');
    expect(redacted.objectKey).toBe('[REDACTED]');
    expect(redacted.safeState).toBe('DELETED');
    expect(
      redactMediaForLog({
        bucket: 'private',
        checksum: 'secret',
        customerPhone: '0900',
        state: 'READY',
      }),
    ).toEqual({ state: 'READY' });
  });

  it('rejects path traversal before generating a local export URL', async () => {
    const storage = new LocalExportDownloadStorage('C:/tmp/adsup-export-security');
    await expect(storage.createDownloadUrl('../outside.xlsx', 300)).rejects.toThrow(
      'EXPORT_OBJECT_SCOPE_VIOLATION',
    );
  });
});
