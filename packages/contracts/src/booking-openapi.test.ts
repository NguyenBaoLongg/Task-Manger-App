import { describe, expect, it } from 'vitest';
import { loadBookingOpenApiDocument } from './index.js';

const methods = new Set(['get', 'post', 'put', 'patch', 'delete']);
const mutations = new Set(['post', 'put', 'patch', 'delete']);

describe('Module 4 OpenAPI', () => {
  it('publishes unique booking, consent, report, retention and XLSX operations', async () => {
    const document = await loadBookingOpenApiDocument();
    const paths = document.paths as Record<string, Record<string, HttpOperation>>;
    const operations = Object.values(paths).flatMap((item) =>
      Object.entries(item)
        .filter(([method]) => methods.has(method))
        .map(([, operation]) => operation.operationId),
    );

    expect(Object.keys(paths)).toHaveLength(24);
    expect(operations).toHaveLength(31);
    expect(new Set(operations).size).toBe(operations.length);
    expect(operations).toEqual(
      expect.arrayContaining([
        'listEffectiveBookingServices',
        'createScheduledBooking',
        'recordCustomerPhotoConsent',
        'createCustomerPhotoUploadIntent',
        'recordBookingArrival',
        'completeBookingTour',
        'rerunBookingReport',
        'createXlsxExport',
        'createExportDownloadUrl',
        'createBookingRetentionPolicyVersion',
        'changeBookingMediaLegalHold',
      ]),
    );
    expect(document.security).toEqual([{ bearerAuth: [] }]);
  });

  it('requires permission metadata and idempotency on every mutation', async () => {
    const document = await loadBookingOpenApiDocument();
    const paths = document.paths as Record<string, Record<string, HttpOperation>>;
    for (const [path, item] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(item)) {
        if (!methods.has(method)) continue;
        expect(operation['x-permission'], `${method.toUpperCase()} ${path}`).toMatch(/^booking\./);
        if (mutations.has(method)) {
          expect(
            operation.parameters?.some((parameter) => parameter.$ref?.endsWith('/IdempotencyKey')),
            `${method.toUpperCase()} ${path}`,
          ).toBe(true);
        }
      }
    }
  });

  it('keeps PDF absent and makes consent precede a booking-scoped photo upload intent', async () => {
    const document = await loadBookingOpenApiDocument();
    const serialized = JSON.stringify(document);
    const paths = document.paths as Record<string, unknown>;
    expect(serialized).toContain('"const":"XLSX"');
    expect(serialized).not.toContain('"const":"PDF"');
    expect(serialized).not.toContain('"enum":["XLSX","PDF"]');
    expect(paths).toHaveProperty(
      '/v1/tenants/{tenantId}/bookings/{bookingId}/customer-photo-consents',
    );
    expect(paths).toHaveProperty(
      '/v1/tenants/{tenantId}/bookings/{bookingId}/customer-photo-upload-intents',
    );
  });
});

interface HttpOperation {
  operationId?: string;
  parameters?: Array<{ $ref?: string }>;
  'x-permission'?: string;
}
