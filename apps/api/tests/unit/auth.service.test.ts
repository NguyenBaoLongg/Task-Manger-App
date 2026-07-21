import { describe, expect, it } from 'vitest';
import type { AuthTenantsRepository } from '@adsup/database';
import { TokenService } from '../../src/modules/auth/token-service.js';

function sessionHarness() {
  const sessions = new Map<
    string,
    {
      id: string;
      userId: string;
      refreshTokenHash: string;
      tokenFamilyId: string;
      expiresAt: Date;
      revokedAt: Date | null;
    }
  >();
  const repository = {
    async createSession(input: {
      id: string;
      userId: string;
      refreshTokenHash: string;
      tokenFamilyId: string;
      expiresAt: Date;
    }) {
      sessions.set(input.id, { ...input, revokedAt: null });
    },
    async getSession(id: string) {
      return sessions.get(id) ?? null;
    },
    async getUser(id: string) {
      return { id, status: 'ACTIVE' };
    },
    async findSessionByHash(hash: string) {
      return [...sessions.values()].find((item) => item.refreshTokenHash === hash) ?? null;
    },
    async rotateSession(input: {
      priorId: string;
      nextId: string;
      userId: string;
      tokenFamilyId: string;
      nextHash: string;
      expiresAt: Date;
    }) {
      const prior = sessions.get(input.priorId);
      if (!prior || prior.revokedAt) return null;
      prior.revokedAt = new Date();
      const next = {
        id: input.nextId,
        userId: input.userId,
        refreshTokenHash: input.nextHash,
        tokenFamilyId: input.tokenFamilyId,
        expiresAt: input.expiresAt,
        revokedAt: null,
      };
      sessions.set(next.id, next);
      return next;
    },
    async revokeSession(id: string) {
      const session = sessions.get(id);
      if (session) session.revokedAt = new Date();
      return { count: session ? 1 : 0 };
    },
    async revokeFamily(family: string) {
      let count = 0;
      for (const session of sessions.values())
        if (session.tokenFamilyId === family) {
          session.revokedAt = new Date();
          count += 1;
        }
      return { count };
    },
  } as unknown as AuthTenantsRepository;
  return { repository, sessions };
}

describe('token rotation', () => {
  it('rotates refresh tokens and rejects replay', async () => {
    const { repository } = sessionHarness();
    const service = new TokenService('s'.repeat(32), 'issuer', 'audience', 900, 3600, repository);
    const issued = await service.issue('10000000-0000-4000-8000-000000000001');
    const rotated = await service.refresh(issued.refreshToken);
    expect(rotated.refreshToken).not.toBe(issued.refreshToken);
    await expect(service.refresh(issued.refreshToken)).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });
  });
});
