import { ApiProblemError } from '@/api/problem';
import type { createApiClient } from '@/api/api-client';

type ApiClient = ReturnType<typeof createApiClient>;

export type CreateCompanyErrorKind = 'locked' | 'network' | 'unknown';

export class CreateCompanyError extends Error {
  readonly kind: CreateCompanyErrorKind;

  constructor(kind: CreateCompanyErrorKind, message: string) {
    super(message);
    this.name = 'CreateCompanyError';
    this.kind = kind;
  }
}

export type CreateCompanyOutcome =
  | { kind: 'created'; tenantId: string; membershipId: string }
  | { kind: 'profile-confirmation-required' };

type BackendCreateTenantResponse = {
  tenant: { id: string };
  membership: { id: string };
};

export const freshCreateCompanyIdempotencyKey = (): string =>
  `mobile-tenant-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createCompany = async (
  client: ApiClient,
  input: { name: string; timezone: string },
  options: { idempotencyKey?: string } = {},
): Promise<CreateCompanyOutcome> => {
  const idempotencyKey = options.idempotencyKey ?? freshCreateCompanyIdempotencyKey();
  let response: BackendCreateTenantResponse;
  try {
    response = await client.request<BackendCreateTenantResponse>('/v1/tenants', {
      method: 'POST',
      body: { name: input.name.trim(), timezone: input.timezone },
      idempotencyKey,
    });
  } catch (error) {
    if (error instanceof ApiProblemError) {
      if (error.code === 'PROFILE_CONFIRMATION_REQUIRED') {
        return { kind: 'profile-confirmation-required' };
      }
      if (error.status === 403) {
        throw new CreateCompanyError('locked', 'Tài khoản đã bị khóa. Hãy liên hệ quản trị viên công ty.');
      }
      if (error.status === 409 && error.code === 'IDEMPOTENCY_KEY_REUSED') {
        throw new CreateCompanyError('unknown', 'Yêu cầu trùng lặp. Hãy thử lại.');
      }
      if (error.status === 422) {
        throw new CreateCompanyError('unknown', 'Thông tin công ty không hợp lệ. Hãy kiểm tra lại.');
      }
      throw new CreateCompanyError('unknown', 'Không thể tạo công ty. Hãy thử lại.');
    }
    throw new CreateCompanyError(
      'network',
      'Không thể kết nối máy chủ. Hãy kiểm tra kết nối mạng rồi thử lại.',
    );
  }
  return {
    kind: 'created',
    tenantId: response.tenant.id,
    membershipId: response.membership.id,
  };
};
