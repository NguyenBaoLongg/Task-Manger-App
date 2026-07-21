import { randomUUID } from 'node:crypto';

export type UUID = string;
export type TenantId = UUID;
export type UserId = UUID;
export type MembershipId = UUID;

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  uuid(): UUID;
}

export const systemClock: Clock = { now: () => new Date() };
export const systemIds: IdGenerator = { uuid: () => randomUUID() };

export interface TenantContext {
  userId: UserId;
  tenantId: TenantId;
  membershipId: MembershipId;
  membershipStatus: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'LEFT';
  correlationId: string;
}

export type ProblemCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'AUTHORIZATION_DENIED'
  | 'PROFILE_CONFIRMATION_REQUIRED'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_GONE'
  | 'VALIDATION_FAILED'
  | 'CONFLICT'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'LAST_OWNER_REQUIRED'
  | 'PROVIDER_UNAVAILABLE'
  | 'BUSINESS_RULE_VIOLATION'
  | 'MULTIPLE_ACTIVE_BRANCHES'
  | 'NO_ACTIVE_BRANCH'
  | 'INTERNAL_ERROR';

export class ProblemError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ProblemCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ProblemError';
  }
}

export function assertSameTenant(expected: TenantId, actual: TenantId): void {
  if (expected !== actual) {
    throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy tài nguyên.');
  }
}

export function requireActiveTenant(context: TenantContext): void {
  if (context.membershipStatus !== 'ACTIVE') {
    throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Tài khoản không có quyền truy cập.');
  }
}

export function problemDocument(error: unknown, correlationId: string) {
  if (error instanceof ProblemError) {
    return {
      type: `https://adsup.app/problems/${error.code.toLowerCase()}`,
      title: error.message,
      status: error.status,
      code: error.code,
      correlationId,
      ...(error.details === undefined ? {} : { errors: error.details }),
    };
  }
  return {
    type: 'https://adsup.app/problems/internal-error',
    title: 'Đã xảy ra lỗi nội bộ.',
    status: 500,
    code: 'INTERNAL_ERROR' as const,
    correlationId,
  };
}
