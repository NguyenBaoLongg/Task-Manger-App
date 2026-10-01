import { describe, it } from 'vitest';
import { expectOperations } from '../helpers/contracts.js';

describe('rbac my-permissions HTTP contract', () => {
  it('covers listing my effective permission codes', async () => {
    await expectOperations(['listMyPermissions']);
  });
});
