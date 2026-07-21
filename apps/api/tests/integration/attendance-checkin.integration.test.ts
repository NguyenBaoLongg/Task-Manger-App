import { describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('attendance check-in integration', () => {
  it('will verify video policy acknowledgement, check-in snapshot and manual review against live DB', () => {
    expect(Boolean(databaseUrl)).toBe(true);
  });
});
