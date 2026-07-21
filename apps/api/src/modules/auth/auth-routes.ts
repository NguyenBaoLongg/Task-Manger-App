import { Router } from 'express';
import { z } from 'zod';
import type { AuthService } from './auth-service.js';
import type { TokenService } from './token-service.js';
import type { GovernanceRepository } from '@adsup/database';
import { authenticate, type AuthenticatedRequest } from '../../http/middleware/auth.js';
import { readIdempotencyKey } from '../../http/idempotency.js';
import { accountIdempotent } from '../../http/idempotency.js';

const googleBody = z
  .object({
    idToken: z.string().min(20).max(8192),
    deviceLabel: z.string().max(120).optional(),
  })
  .strict();
const refreshBody = z.object({ refreshToken: z.string().min(32).max(2048) }).strict();
const profileBody = z.object({ fullName: z.string().min(2).max(120) }).strict();

export function authRoutes(
  service: AuthService,
  tokens: TokenService,
  governance?: GovernanceRepository,
): Router {
  const router = Router();
  router.post('/auth/google', async (request: AuthenticatedRequest, response) => {
    const idToken = googleBody.parse(request.body).idToken;
    response
      .status(200)
      .json(
        await service.login(
          idToken,
          readIdempotencyKey(request),
          governance,
          request.header('x-correlation-id')!,
        ),
      );
  });
  router.post('/auth/refresh', async (request: AuthenticatedRequest, response) => {
    const body = refreshBody.parse(request.body);
    response
      .status(200)
      .json(await tokens.refresh(body.refreshToken, readIdempotencyKey(request), governance));
  });
  router.post(
    '/auth/logout',
    authenticate(tokens, { allowRevokedSession: true }),
    async (request: AuthenticatedRequest, response) => {
      await accountIdempotent(
        governance,
        request,
        'auth.logout',
        { sessionId: request.auth!.sessionId },
        async () => {
          await tokens.logout(request.auth!.sessionId);
          return { ok: true };
        },
      );
      response.status(204).send();
    },
  );
  router.get('/me', authenticate(tokens), async (request: AuthenticatedRequest, response) =>
    response.json(await service.me(request.auth!.userId)),
  );
  router.patch('/me', authenticate(tokens), async (request: AuthenticatedRequest, response) => {
    const body = profileBody.parse(request.body);
    response.json(
      await accountIdempotent(governance, request, 'profile.confirm', body, () =>
        service.confirmProfile(
          request.auth!.userId,
          body.fullName,
          request.header('x-correlation-id')!,
        ),
      ),
    );
  });
  return router;
}
