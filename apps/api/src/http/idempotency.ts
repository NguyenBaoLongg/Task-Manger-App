import { z } from 'zod';
import type { GovernanceRepository } from '@adsup/database';
import type { AuthenticatedRequest } from './middleware/auth.js';

export function readIdempotencyKey(request: AuthenticatedRequest): string {
  return z.string().min(8).max(128).parse(request.header('idempotency-key'));
}

export async function tenantIdempotent<T>(
  governance: GovernanceRepository | undefined,
  request: AuthenticatedRequest,
  operation: string,
  requestBody: unknown,
  action: () => Promise<T>,
): Promise<T> {
  const key = readIdempotencyKey(request);
  if (!governance) return action();
  return (
    await governance.executeTenantIdempotent({
      tenantId: request.tenant!.tenantId,
      membershipId: request.tenant!.membershipId,
      operation,
      key,
      request: requestBody,
      action,
    })
  ).value;
}

export async function accountIdempotent<T>(
  governance: GovernanceRepository | undefined,
  request: AuthenticatedRequest,
  operation: string,
  requestBody: unknown,
  action: () => Promise<T>,
): Promise<T> {
  const key = readIdempotencyKey(request);
  if (!governance) return action();
  return (
    await governance.executeAccountIdempotent({
      userId: request.auth!.userId,
      operation,
      key,
      request: requestBody,
      action,
    })
  ).value;
}
