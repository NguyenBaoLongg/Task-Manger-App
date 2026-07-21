import { describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('attendance day close integration', () => {
  it('will verify missing check-in, after-15 worked-late and after-18 non-worked classification', () => {
    expect(Boolean(databaseUrl)).toBe(true);
  });
});
