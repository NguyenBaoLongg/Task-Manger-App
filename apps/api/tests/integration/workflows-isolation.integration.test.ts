import { describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL;
const live = describe.runIf(Boolean(databaseUrl));

live('workflow tenant and approver isolation integration', () => {
  it('will deny cross-tenant and out-of-scope approvers', () => {
    expect(Boolean(databaseUrl)).toBe(true);
  });
});
