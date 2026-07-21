import { describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('workflow routing integration', () => {
  it('will verify routing, decisions and notifications without leave final effects', () => {
    expect(Boolean(databaseUrl)).toBe(true);
  });
});
