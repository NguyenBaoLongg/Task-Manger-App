import { ProblemError, type GoogleIdentityVerifier } from '@adsup/domain';
import type { AuthTenantsRepository, GovernanceRepository } from '@adsup/database';
import type { TokenService } from './token-service.js';

export class AuthService {
  constructor(
    private readonly google: GoogleIdentityVerifier,
    private readonly repository: AuthTenantsRepository,
    private readonly tokens: TokenService,
  ) {}
  async login(
    idToken: string,
    idempotencyKey?: string,
    governance?: GovernanceRepository,
    correlationId = 'system',
  ) {
    const principal = await this.google.verify(idToken);
    const user = await this.repository.loginWithGoogle(principal, correlationId);
    if (user.status !== 'ACTIVE')
      throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Tài khoản đã bị khóa.');
    const action = async () => ({
      user: this.presentUser(user),
      ...(await this.tokens.issue(user.id)),
    });
    if (!governance || !idempotencyKey) return action();
    return (
      await governance.executeAccountIdempotent({
        userId: user.id,
        operation: 'auth.google',
        key: idempotencyKey,
        request: { providerSubject: principal.subject },
        action,
      })
    ).value;
  }
  async me(userId: string) {
    const user = await this.repository.getUser(userId);
    if (!user) throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy tài khoản.');
    return this.presentUser(user);
  }
  async confirmProfile(userId: string, fullName: string, correlationId = 'system') {
    const normalized = fullName.trim().replace(/\s+/g, ' ');
    if (normalized.length < 2 || normalized.length > 120)
      throw new ProblemError(422, 'VALIDATION_FAILED', 'Họ tên phải có từ 2 đến 120 ký tự.');
    return this.presentUser(
      await this.repository.confirmProfile(userId, normalized, correlationId),
    );
  }
  private presentUser(user: {
    id: string;
    fullName: string | null;
    fullNameConfirmedAt: Date | null;
    status: string;
  }) {
    return {
      id: user.id,
      fullName: user.fullName,
      profileComplete: Boolean(user.fullName && user.fullNameConfirmedAt),
      status: user.status,
    };
  }
}
