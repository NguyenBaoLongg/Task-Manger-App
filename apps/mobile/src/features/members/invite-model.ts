import type { createApiClient } from '@/api/api-client';

type ApiClient = ReturnType<typeof createApiClient>;

export type InviteRole = { id: string; name: string; code: string; kind?: string };

export type InvitationResult = {
  id: string;
  token: string;
  tokenHint: string;
  expiresAt: string;
  inviteUrl?: string;
};

type BackendInvitation = {
  id: string;
  type: string;
  state: string;
  tokenHint: string;
  maxUses: number;
  useCount: number;
  expiresAt: string;
  token: string;
  inviteUrl?: string;
};

export const INVITATION_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;

export const buildInvitationExpiresAt = (nowMs: number): Date =>
  new Date(nowMs + INVITATION_VALIDITY_MS);

export const parseInvitationResult = (response: BackendInvitation): InvitationResult => ({
  id: response.id,
  token: response.token,
  tokenHint: response.tokenHint,
  expiresAt: response.expiresAt,
  inviteUrl: response.inviteUrl,
});

export const freshInvitationIdempotencyKey = (): string =>
  `mobile-invite-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const listInviteRoles = async (client: ApiClient, tenantId: string): Promise<InviteRole[]> =>
  client.tenant(tenantId).request<InviteRole[]>('/roles');

export const createInvitation = async (
  client: ApiClient,
  tenantId: string,
  roleId: string,
  options: { idempotencyKey?: string; nowMs?: number } = {},
): Promise<InvitationResult> => {
  const idempotencyKey = options.idempotencyKey ?? freshInvitationIdempotencyKey();
  const response = await client.tenant(tenantId).request<BackendInvitation>('/invitations', {
    method: 'POST',
    body: {
      type: 'DIRECT',
      roleId,
      expiresAt: buildInvitationExpiresAt(options.nowMs ?? Date.now()).toISOString(),
    },
    idempotencyKey,
  });
  return parseInvitationResult(response);
};

export const buildSharePayload = (invitation: InvitationResult): string =>
  [
    'Mời bạn tham gia công ty trên ADSUP.',
    `Mã lời mời: ${invitation.token}`,
    `Mã có hiệu lực đến ${new Date(invitation.expiresAt).toLocaleString('vi-VN')}.`,
  ].join('\n');
