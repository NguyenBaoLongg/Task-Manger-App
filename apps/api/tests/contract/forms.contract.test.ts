import { describe, it } from 'vitest';
import { expectOperations } from '../helpers/contracts.js';
describe('forms HTTP contract', () => {
  it('covers template, publish and submission', async () =>
    expectOperations([
      'listFormTemplates',
      'createFormTemplate',
      'publishFormVersion',
      'archiveFormTemplate',
      'retireFormVersion',
      'submitDynamicForm',
    ]));
});
