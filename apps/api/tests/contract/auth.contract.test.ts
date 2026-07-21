import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, type AppDependencies } from '../../src/app.js';
import { testConfig } from '../helpers/config.js';
import { expectOperations } from '../helpers/contracts.js';

describe('auth HTTP contract', () => {
  it('publishes Google/profile/refresh/logout operations', async () => {
    await expectOperations([
      'authenticateWithGoogle',
      'refreshSession',
      'logoutSession',
      'getCurrentUser',
      'confirmCurrentUserProfile',
    ]);
  });
  it('returns safe validation problem with correlation id', async () => {
    const app = createApp({
      config: testConfig,
      authService: {
        async login() {
          return {};
        },
      },
    } as unknown as AppDependencies);
    const response = await request(app)
      .post('/v1/auth/google')
      .set('x-correlation-id', 'contract-auth-1')
      .send({});
    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      correlationId: 'contract-auth-1',
    });
  });
});
