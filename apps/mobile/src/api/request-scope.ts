export type RequestScope = {
  tenantId: string;
  branchId?: string;
  membershipId?: string;
  contextVersion?: number;
};

export const tenantPath = (scope: Pick<RequestScope, 'tenantId'>, path: string): string => {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `/v1/tenants/${encodeURIComponent(scope.tenantId)}${suffix}`;
};
