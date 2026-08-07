export type TenantContextValue = {
  tenantId: string;
  membershipId: string;
  branchId?: string;
  permissions: readonly string[];
  version: number;
};

export const createTenantContext = (value: TenantContextValue) => {
  const permissions = new Set(value.permissions);
  return {
    ...value,
    can: (permission: string) => permissions.has(permission),
    assertScope: (resource: { tenantId: string; branchId?: string }) => {
      if (resource.tenantId !== value.tenantId) throw new Error('TENANT_SCOPE_MISMATCH');
      if (value.branchId && resource.branchId && resource.branchId !== value.branchId) {
        throw new Error('BRANCH_SCOPE_MISMATCH');
      }
      return true;
    },
  };
};

export type TenantContext = ReturnType<typeof createTenantContext>;
