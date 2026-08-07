import fs from 'node:fs';
import path from 'node:path';

describe('booking and dynamic form contract', () => {
  const booking = fs.readFileSync(
    path.resolve(__dirname, '../../../../specs/004-booking-export/contracts/openapi.yaml'),
    'utf8',
  );
  const foundation = fs.readFileSync(
    path.resolve(__dirname, '../../../../specs/001-multitenant-foundation/contracts/openapi.yaml'),
    'utf8',
  );
  it('publishes branch-scoped booking, consent, arrival, outcome and reschedule operations', () => {
    for (const route of [
      '/customers:',
      '/bookings:',
      '/bookings:walk-in:',
      '/customer-photo-consents:',
      '/customer-photo-upload-intents:',
      '/arrivals:',
      '/outcomes:',
      '/reschedules:',
      '/tour-completions:',
    ])
      expect(booking).toContain(route);
    expect(foundation).toContain('/v1/tenants/{tenantId}/form-templates:');
  });
});
