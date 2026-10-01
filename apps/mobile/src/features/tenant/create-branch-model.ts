import { ApiProblemError } from '@/api/problem';
import type { createApiClient } from '@/api/api-client';

type ApiClient = ReturnType<typeof createApiClient>;

export type CreateBranchErrorKind = 'locked' | 'network' | 'unknown';

export class CreateBranchError extends Error {
  readonly kind: CreateBranchErrorKind;

  constructor(kind: CreateBranchErrorKind, message: string) {
    super(message);
    this.name = 'CreateBranchError';
    this.kind = kind;
  }
}

export type CreateBranchOutcome = { kind: 'created'; branchId: string; name: string };

type BackendCreateBranchResponse = { id: string; name: string };

export const freshCreateBranchIdempotencyKey = (): string =>
  `mobile-branch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createBranch = async (
  client: ApiClient,
  tenantId: string,
  input: { code: string; name: string },
  options: { idempotencyKey?: string } = {},
): Promise<CreateBranchOutcome> => {
  const idempotencyKey = options.idempotencyKey ?? freshCreateBranchIdempotencyKey();
  let response: BackendCreateBranchResponse;
  try {
    response = await client.tenant(tenantId).request<BackendCreateBranchResponse>('/branches', {
      method: 'POST',
      body: { code: input.code.trim().toUpperCase(), name: input.name.trim() },
      idempotencyKey,
    });
  } catch (error) {
    if (error instanceof ApiProblemError) {
      if (error.status === 403) {
        throw new CreateBranchError(
          'locked',
          'Tài khoản không có quyền tạo cơ sở. Hãy liên hệ quản trị viên công ty.',
        );
      }
      if (error.status === 409 && error.code === 'IDEMPOTENCY_KEY_REUSED') {
        throw new CreateBranchError('unknown', 'Yêu cầu trùng lặp. Hãy thử lại.');
      }
      if (error.status === 422) {
        throw new CreateBranchError('unknown', 'Thông tin cơ sở không hợp lệ. Hãy kiểm tra lại.');
      }
      throw new CreateBranchError('unknown', 'Không thể tạo cơ sở. Hãy thử lại.');
    }
    throw new CreateBranchError(
      'network',
      'Không thể kết nối máy chủ. Hãy kiểm tra kết nối mạng rồi thử lại.',
    );
  }
  return { kind: 'created', branchId: response.id, name: response.name };
};
