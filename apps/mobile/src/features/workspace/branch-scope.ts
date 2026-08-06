import type { TenantContextValue } from '@/tenant/tenant-context';

export const createBranchScope = (context: TenantContextValue, branchId: string) => {
  if (!branchId) throw new Error('BRANCH_REQUIRED');
  return {
    ...context,
    branchId,
    summary: `${context.tenantId} · ${branchId}`,
  };
};
