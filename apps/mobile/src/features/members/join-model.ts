import { ApiProblemError } from '@/api/problem';
import type { createApiClient } from '@/api/api-client';

type ApiClient = ReturnType<typeof createApiClient>;

export type JoinErrorKind = 'invalid' | 'gone' | 'locked' | 'network' | 'unknown';

export class JoinError extends Error {
  readonly kind: JoinErrorKind;

  constructor(kind: JoinErrorKind, message: string) {
    super(message);
    this.name = 'JoinError';
    this.kind = kind;
  }
}

export type AcceptOutcome =
  | { kind: 'joined'; tenantId: string; membershipId: string }
  | { kind: 'profile-confirmation-required' };

type BackendAcceptResponse = {
  id: string;
  tenantId: string;
};

export const freshJoinIdempotencyKey = (): string =>
  `mobile-join-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const acceptInvitation = async (
  client: ApiClient,
  rawToken: string,
  options: { idempotencyKey?: string } = {},
): Promise<AcceptOutcome> => {
  const token = rawToken.trim();
  const idempotencyKey = options.idempotencyKey ?? freshJoinIdempotencyKey();
  let response: BackendAcceptResponse;
  try {
    response = await client.request<BackendAcceptResponse>('/v1/invitations/accept', {
      method: 'POST',
      body: { token },
      idempotencyKey,
    });
  } catch (error) {
    if (error instanceof ApiProblemError) {
      if (error.code === 'PROFILE_CONFIRMATION_REQUIRED') {
        return { kind: 'profile-confirmation-required' };
      }
      if (error.code === 'RESOURCE_GONE') {
        throw new JoinError('gone', 'Lời mời không còn hiệu lực.');
      }
      if (error.code === 'AUTHORIZATION_DENIED') {
        throw new JoinError('locked', 'Tài khoản đã bị khóa. Hãy liên hệ quản trị viên công ty.');
      }
      if (error.status === 422) {
        throw new JoinError('invalid', 'Mã lời mời không hợp lệ. Hãy kiểm tra lại.');
      }
      throw new JoinError('unknown', 'Không thể tham gia công ty. Hãy thử lại.');
    }
    throw new JoinError(
      'network',
      'Không thể kết nối máy chủ. Hãy kiểm tra kết nối mạng rồi thử lại.',
    );
  }
  return {
    kind: 'joined',
    tenantId: response.tenantId,
    membershipId: response.id,
  };
};

export const completePendingJoin = (client: ApiClient, token: string, idempotencyKey: string) =>
  acceptInvitation(client, token, { idempotencyKey });
