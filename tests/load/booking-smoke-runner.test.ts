import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Module 4 load smoke wiring', () => {
  it('exposes a booking profile from the root smoke runner', async () => {
    const rootRunner = await readFile(new URL('./smoke-runner.mjs', import.meta.url), 'utf8');
    const bookingRunner = await readFile(
      new URL('./booking-smoke-runner.mjs', import.meta.url),
      'utf8',
    );

    expect(rootRunner).toContain("await import('./booking-smoke-runner.mjs')");
    expect(bookingRunner).toContain('/v1/tenants/{tenantId}/bookings');
    expect(bookingRunner).toContain('BOOKING_LOAD_SMOKE_OK');
  });
});
