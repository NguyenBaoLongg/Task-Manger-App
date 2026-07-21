import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { ChatNotificationsRepository, GovernanceRepository } from '@adsup/database';
import type { TokenService } from '../auth/token-service.js';
import { authenticate, type AuthenticatedRequest } from '../../http/middleware/auth.js';
import { accountIdempotent } from '../../http/idempotency.js';
import { ProblemError } from '@adsup/domain';

function encryptToken(token: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function notificationRoutes(
  tokens: TokenService,
  repository: ChatNotificationsRepository,
  encryptionSecret: string,
  governance?: GovernanceRepository,
): Router {
  const router = Router();
  const auth = authenticate(tokens);
  router.post('/notification-endpoints', auth, async (request: AuthenticatedRequest, response) => {
    const body = z
      .object({
        platform: z.enum(['IOS', 'ANDROID']),
        provider: z.enum(['FCM', 'APNS']),
        token: z.string().min(20).max(4096),
      })
      .strict()
      .parse(request.body);
    const fingerprint = createHash('sha256').update(body.token).digest('hex');
    const endpoint = await accountIdempotent(
      governance,
      request,
      'notification-endpoint.register',
      { ...body, token: fingerprint },
      () =>
        repository.registerEndpoint({
          userId: request.auth!.userId,
          platform: body.platform,
          provider: body.provider,
          tokenCiphertext: encryptToken(body.token, encryptionSecret),
          tokenFingerprint: fingerprint,
        }),
    );
    response.status(200).json({
      id: endpoint.id,
      platform: endpoint.platform,
      provider: endpoint.provider,
      status: endpoint.status,
      lastSeenAt: endpoint.lastSeenAt,
    });
  });
  router.post(
    '/notification-endpoints/:endpointId/revoke',
    auth,
    async (request: AuthenticatedRequest, response) => {
      const result = await accountIdempotent(
        governance,
        request,
        'notification-endpoint.revoke',
        { endpointId: request.params.endpointId },
        () => repository.revokeEndpoint(request.auth!.userId, String(request.params.endpointId)),
      );
      if (result.count !== 1)
        throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy thiết bị thông báo.');
      response.status(204).send();
    },
  );
  return router;
}
