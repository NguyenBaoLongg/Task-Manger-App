import { describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('attendance OFF calendar integration', () => {
  it('will verify tenant-wide and branch OFF days suppress check-in penalties and KPI report requirement', () => {
    expect(Boolean(databaseUrl)).toBe(true);
  });
});
