import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { ProblemError } from '@adsup/domain';
import type { AuthTenantsRepository, GovernanceRepository } from '@adsup/database';

export interface AccessPrincipal {
  userId: string;
  sessionId: string;
}

export class TokenService {
  private readonly secret: Uint8Array;
  constructor(
    secret: string,
    private readonly issuer: string,
    private readonly audience: string,
    private readonly accessTtlSeconds: number,
    private readonly refreshTtlSeconds: number,
    private readonly sessions: Pick<
      AuthTenantsRepository,
      | 'createSession'
      | 'findSessionByHash'
      | 'getSession'
      | 'rotateSession'
      | 'revokeSession'
      | 'revokeFamily'
      | 'getUser'
    >,
  ) {
    this.secret = new TextEncoder().encode(secret);
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
  private opaque() {
    return randomBytes(48).toString('base64url');
  }

  private async access(userId: string, sessionId: string) {
    return new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(userId)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(`${this.accessTtlSeconds}s`)
      .sign(this.secret);
  }

  async issue(userId: string, tokenFamilyId = randomUUID()) {
    const sessionId = randomUUID();
    const refreshToken = this.opaque();
    const issuedAt = Date.now();
    const refreshExpiresAt = new Date(issuedAt + this.refreshTtlSeconds * 1_000);
    await this.sessions.createSession({
      id: sessionId,
      userId,
      refreshTokenHash: this.hash(refreshToken),
      tokenFamilyId,
      expiresAt: refreshExpiresAt,
    });
    return {
      accessToken: await this.access(userId, sessionId),
      refreshToken,
      accessExpiresAt: new Date(issuedAt + this.accessTtlSeconds * 1_000).toISOString(),
      refreshExpiresAt: refreshExpiresAt.toISOString(),
    };
  }

  async verifyAccess(token: string): Promise<AccessPrincipal> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: this.issuer,
        audience: this.audience,
      });
      if (!payload.sub || typeof payload.sid !== 'string') throw new Error('claims');
      const user = await this.sessions.getUser(payload.sub);
      const session = await this.sessions.getSession(payload.sid);
      if (
        !user ||
        user.status !== 'ACTIVE' ||
        !session ||
        session.revokedAt ||
        session.expiresAt <= new Date()
      )
        throw new Error('inactive');
      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      throw new ProblemError(401, 'AUTHENTICATION_REQUIRED', 'Phiên đăng nhập không hợp lệ.');
    }
  }

  async verifyLogoutAccess(token: string): Promise<AccessPrincipal> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: this.issuer,
        audience: this.audience,
      });
      if (!payload.sub || typeof payload.sid !== 'string') throw new Error('claims');
      const user = await this.sessions.getUser(payload.sub);
      const session = await this.sessions.getSession(payload.sid);
      if (!user || user.status !== 'ACTIVE' || !session || session.userId !== user.id)
        throw new Error('invalid');
      return { userId: user.id, sessionId: session.id };
    } catch {
      throw new ProblemError(401, 'AUTHENTICATION_REQUIRED', 'Phiên đăng nhập không hợp lệ.');
    }
  }

  async refresh(refreshToken: string, idempotencyKey?: string, governance?: GovernanceRepository) {
    const current = await this.sessions.findSessionByHash(this.hash(refreshToken));
    if (!current || current.expiresAt <= new Date())
      throw new ProblemError(401, 'AUTHENTICATION_REQUIRED', 'Refresh token không hợp lệ.');
    const action = () => this.rotateRefresh(current, refreshToken);
    if (!idempotencyKey || !governance) return action();
    return (
      await governance.executeAccountIdempotent({
        userId: current.userId,
        operation: 'auth.refresh',
        key: idempotencyKey,
        request: { refreshTokenHash: this.hash(refreshToken) },
        action,
      })
    ).value;
  }

  private async rotateRefresh(
    current: NonNullable<Awaited<ReturnType<AuthTenantsRepository['findSessionByHash']>>>,
    _refreshToken: string,
  ) {
    if (current.revokedAt) {
      await this.sessions.revokeFamily(current.tokenFamilyId, 'REFRESH_REPLAY');
      throw new ProblemError(
        401,
        'AUTHENTICATION_REQUIRED',
        'Phát hiện refresh token đã được dùng.',
      );
    }
    const nextRefresh = this.opaque();
    const nextId = randomUUID();
    const issuedAt = Date.now();
    const refreshExpiresAt = new Date(issuedAt + this.refreshTtlSeconds * 1_000);
    const rotated = await this.sessions.rotateSession({
      priorId: current.id,
      nextId,
      userId: current.userId,
      tokenFamilyId: current.tokenFamilyId,
      nextHash: this.hash(nextRefresh),
      expiresAt: refreshExpiresAt,
    });
    if (!rotated)
      throw new ProblemError(401, 'AUTHENTICATION_REQUIRED', 'Refresh token đã được dùng.');
    return {
      accessToken: await this.access(current.userId, nextId),
      refreshToken: nextRefresh,
      accessExpiresAt: new Date(issuedAt + this.accessTtlSeconds * 1_000).toISOString(),
      refreshExpiresAt: refreshExpiresAt.toISOString(),
    };
  }

  async logout(sessionId: string) {
    await this.sessions.revokeSession(sessionId, 'LOGOUT');
  }
  tokensEqual(left: string, right: string) {
    const a = Buffer.from(this.hash(left));
    const b = Buffer.from(this.hash(right));
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
