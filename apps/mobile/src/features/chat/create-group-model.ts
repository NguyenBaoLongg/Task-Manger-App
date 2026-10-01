import { ApiProblemError } from '@/api/problem';
import type { createApiClient } from '@/api/api-client';

type ApiClient = ReturnType<typeof createApiClient>;

export type CreateGroupErrorKind = 'locked' | 'invalid-member' | 'network' | 'unknown';

export class CreateGroupError extends Error {
  readonly kind: CreateGroupErrorKind;

  constructor(kind: CreateGroupErrorKind, message: string) {
    super(message);
    this.name = 'CreateGroupError';
    this.kind = kind;
  }
}

export type GroupMember = { id: string; displayName: string };

export const MIN_GROUP_NAME_LENGTH = 2;
export const MAX_GROUP_NAME_LENGTH = 120;

export const validateGroupName = (name: string): string | undefined => {
  const trimmed = name.trim();
  if (trimmed.length < MIN_GROUP_NAME_LENGTH) return 'Tên nhóm cần ít nhất 2 ký tự.';
  if (trimmed.length > MAX_GROUP_NAME_LENGTH)
    return `Tên nhóm tối đa ${MAX_GROUP_NAME_LENGTH} ký tự.`;
  return undefined;
};

export const freshGroupIdempotencyKey = (): string =>
  `chat-group-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

type BackendChannelResponse = { id: string; name: string };

export const createGroup = async (
  client: ApiClient,
  tenantId: string,
  input: { name: string; membershipIds: readonly string[]; idempotencyKey: string },
): Promise<BackendChannelResponse> => {
  const nameError = validateGroupName(input.name);
  if (nameError) throw new CreateGroupError('unknown', nameError);
  try {
    return await client.tenant(tenantId).request<BackendChannelResponse>('/channels', {
      method: 'POST',
      body: { type: 'GROUP', name: input.name.trim(), membershipIds: [...input.membershipIds] },
      idempotencyKey: input.idempotencyKey,
    });
  } catch (error) {
    if (error instanceof ApiProblemError) {
      if (error.status === 403) {
        throw new CreateGroupError('locked', 'Bạn không có quyền tạo nhóm chat.');
      }
      if (error.status === 404) {
        throw new CreateGroupError(
          'invalid-member',
          'Một thành viên được chọn không còn hoạt động. Hãy bỏ chọn và thử lại.',
        );
      }
      if (error.status === 409 && error.code === 'IDEMPOTENCY_KEY_REUSED') {
        throw new CreateGroupError('unknown', 'Yêu cầu trùng lặp. Hãy thử lại.');
      }
      if (error.status === 422) {
        throw new CreateGroupError('unknown', 'Tên nhóm không hợp lệ. Hãy kiểm tra lại.');
      }
      throw new CreateGroupError('unknown', 'Không tạo được nhóm. Hãy thử lại.');
    }
    throw new CreateGroupError(
      'network',
      'Không thể kết nối máy chủ. Hãy kiểm tra kết nối mạng rồi thử lại.',
    );
  }
};

type BackendMembershipsPage = {
  items: Array<{
    id: string;
    membershipDisplayName: string;
    displayName: string;
    status: string;
  }>;
  nextCursor: string | null;
};

export const listGroupCandidates = async (
  client: ApiClient,
  tenantId: string,
  viewerMembershipId: string,
): Promise<GroupMember[]> => {
  const page = await client.tenant(tenantId).request<BackendMembershipsPage>('/memberships');
  return page.items
    .filter((item) => item.status === 'ACTIVE' && item.id !== viewerMembershipId)
    .map((item) => ({ id: item.id, displayName: item.displayName }));
};
