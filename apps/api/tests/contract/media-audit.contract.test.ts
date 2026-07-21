import { describe, it } from 'vitest';
import { expectOperations } from '../helpers/contracts.js';
describe('media and audit HTTP contract', () => {
  it('covers signed media lifecycle and audit query', async () =>
    expectOperations([
      'createMediaUploadIntent',
      'completeMediaUpload',
      'createMediaDownloadUrl',
      'listAuditEvents',
    ]));
});
