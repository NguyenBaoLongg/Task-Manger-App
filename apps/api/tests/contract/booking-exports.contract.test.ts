import { describe, expect, it } from 'vitest';
import {
  createExportSchema,
  exportPageSchema,
  exportSchema,
  signedDownloadSchema,
} from '@adsup/contracts';
import { readFileSync } from 'node:fs';

const openapi = readFileSync('specs/004-booking-export/contracts/openapi.yaml', 'utf8');
const id = '10000000-0000-4000-8000-000000000001';

describe('booking XLSX export contracts', () => {
  it('publishes all export operations with explicit permissions', () => {
    expect(openapi).toContain('operationId: listExports');
    expect(openapi).toContain('operationId: createXlsxExport');
    expect(openapi).toContain('operationId: getExport');
    expect(openapi).toContain('operationId: createExportDownloadUrl');
    expect(openapi).toContain('x-permission: booking.export.create');
    expect(openapi).toContain('x-permission: booking.export.download');
  });

  it('rejects PDF and invalid date ranges while validating response schemas', () => {
    expect(() =>
      createExportSchema.parse({
        format: 'PDF',
        dataTypes: ['BOOKINGS'],
        dateFrom: '2031-01-02',
        dateTo: '2031-01-01',
        branchIds: [id],
      }),
    ).toThrow();
    expect(
      exportSchema.parse({
        id,
        format: 'XLSX',
        dataTypes: ['BOOKINGS'],
        dateFrom: '2031-01-01',
        dateTo: '2031-01-02',
        branchIds: [id],
        state: 'READY',
        progressRows: 2,
        byteSize: 100,
        checksumSha256: 'a'.repeat(64),
        expiresAt: '2031-02-01T00:00:00.000Z',
        safeErrorCode: null,
        createdAt: '2031-01-01T00:00:00.000Z',
      }).state,
    ).toBe('READY');
    expect(exportPageSchema.parse({ items: [], nextCursor: null }).items).toHaveLength(0);
    expect(
      signedDownloadSchema.parse({
        url: 'https://example.test/download',
        expiresAt: '2031-01-01T00:00:00.000Z',
      }),
    ).toHaveProperty('url');
  });
});
