import { describe, it } from 'vitest';
import { expectOperations } from '../helpers/contracts.js';
describe('chat and notification HTTP contract', () => {
  it('covers channels, messages and self-owned endpoints', async () =>
    expectOperations([
      'listChannels',
      'createChannel',
      'listMessages',
      'sendMessage',
      'registerNotificationEndpoint',
      'revokeNotificationEndpoint',
    ]));
});
