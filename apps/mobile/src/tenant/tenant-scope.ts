import type { TenantContext } from './tenant-context';

export const tenantQueryKey = (context: TenantContext, parts: readonly unknown[]) => [
  'tenant',
  context.tenantId,
  'branch',
  context.branchId ?? '*',
  'membership',
  context.membershipId,
  'v',
  context.version,
  ...parts,
];

export const tenantRoom = (context: TenantContext, name: string) =>
  `tenant:${context.tenantId}:branch:${context.branchId ?? '*'}:${name}`;
