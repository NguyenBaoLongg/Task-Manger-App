import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExportService } from '../../src/modules/bookings/export-service.js';
import { LocalExportDownloadStorage } from '../../src/modules/bookings/export-local-storage.js';

describe('booking export download authorization', () => {
  it('rechecks every branch and expiry before issuing a URL', async () => {
    const repository = {
      getExport: vi.fn().mockResolvedValue({
        id: '10000000-0000-4000-8000-000000000099',
        tenantId: '10000000-0000-4000-8000-000000000010',
        requesterMembershipId: '10000000-0000-4000-8000-000000000011',
        branchScopeJson: ['10000000-0000-4000-8000-000000000012'],
        state: 'READY',
        mediaObjectId: '10000000-0000-4000-8000-000000000013',
        mediaObject: { objectKey: 'tenant/exports/export.xlsx' },
        expiresAt: new Date(Date.now() + 60_000),
      }),
    };
    const authorization = { hasPermission: vi.fn().mockResolvedValue(true) };
    const storage = {
      createDownloadUrl: vi
        .fn()
        .mockResolvedValue({ url: 'memory://download', expiresAt: new Date() }),
    };
    const service = new ExportService(
      repository as never,
      authorization as never,
      storage as never,
    );
    await expect(
      service.createDownloadUrl({
        tenantId: '10000000-0000-4000-8000-000000000010',
        actorMembershipId: '10000000-0000-4000-8000-000000000011',
        exportId: '10000000-0000-4000-8000-000000000099',
      }),
    ).resolves.toMatchObject({ url: 'memory://download' });
    authorization.hasPermission.mockResolvedValue(false);
    await expect(
      service.createDownloadUrl({
        tenantId: '10000000-0000-4000-8000-000000000010',
        actorMembershipId: '10000000-0000-4000-8000-000000000011',
        exportId: '10000000-0000-4000-8000-000000000099',
      }),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_DENIED' });
  });

  it('makes a worker-written local artifact visible to the API download adapter', async () => {
    const root = await mkdtemp(join(tmpdir(), 'adsup-export-download-'));
    try {
      const objectKey = 'tenant/exports/export.xlsx';
      const artifact = join(root, objectKey);
      await mkdir(dirname(artifact), { recursive: true });
      await writeFile(artifact, Buffer.from('xlsx'));
      const storage = new LocalExportDownloadStorage(root);
      const result = await storage.createDownloadUrl(objectKey, 300);
      expect(result.url).toContain('local://download/');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
