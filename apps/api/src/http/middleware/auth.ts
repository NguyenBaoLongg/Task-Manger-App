import type { NextFunction, Request, Response } from 'express';
import { ProblemError, type TenantContext } from '@adsup/domain';
import type { AuthTenantsRepository } from '@adsup/database';
import type { OrganizationRbacRepository } from '@adsup/database';
import type { PermissionCode } from '@adsup/domain';
import type { TokenService } from '../../modules/auth/token-service.js';

export interface AuthenticatedRequest extends Request {
  auth?: { userId: string; sessionId: string };
  tenant?: TenantContext;
}

export const authenticate =
  (tokens: TokenService, options?: { allowRevokedSession?: boolean }) =>
  async (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    try {
      const value = request.header('authorization');
      if (!value?.startsWith('Bearer '))
        throw new ProblemError(401, 'AUTHENTICATION_REQUIRED', 'Cần đăng nhập.');
      request.auth = options?.allowRevokedSession
        ? await tokens.verifyLogoutAccess(value.slice(7))
        : await tokens.verifyAccess(value.slice(7));
      next();
    } catch (error) {
      next(error);
    }
  };

export const tenantContext =
  (repository: AuthTenantsRepository, options?: { allowInactiveTenant?: boolean }) =>
  async (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    try {
      if (!request.auth) throw new ProblemError(401, 'AUTHENTICATION_REQUIRED', 'Cần đăng nhập.');
      const tenantId = String(request.params.tenantId ?? '');
      if (!tenantId)
        throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy tài nguyên.');
      const membership = await repository.findMembership(tenantId, request.auth.userId);
      if (!membership || membership.status !== 'ACTIVE')
        throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy tài nguyên.');
      const tenant = await repository.getTenant(tenantId);
      if (!tenant || (!options?.allowInactiveTenant && tenant.status !== 'ACTIVE'))
        throw new ProblemError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy tài nguyên.');
      request.tenant = {
        userId: request.auth.userId,
        tenantId,
        membershipId: membership.id,
        membershipStatus: membership.status,
        correlationId: request.header('x-correlation-id')!,
      };
      next();
    } catch (error) {
      next(error);
    }
  };

export const requirePermission =
  (
    repository: OrganizationRbacRepository,
    permission: PermissionCode,
    branchIdFromRequest?: (request: AuthenticatedRequest) => string | undefined,
  ) =>
  async (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    try {
      if (!request.tenant)
        throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Không có quyền truy cập.');
      const allowed = await repository.hasPermission(
        request.tenant.tenantId,
        request.tenant.membershipId,
        permission,
        branchIdFromRequest?.(request),
      );
      if (!allowed)
        throw new ProblemError(
          403,
          'AUTHORIZATION_DENIED',
          'Không có quyền thực hiện thao tác này.',
        );
      next();
    } catch (error) {
      next(error);
    }
  };

export const requireAnyScopedPermission =
  (repository: OrganizationRbacRepository, permission: PermissionCode) =>
  async (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    try {
      if (!request.tenant)
        throw new ProblemError(403, 'AUTHORIZATION_DENIED', 'Không có quyền truy cập.');
      const allowed = await repository.hasAnyPermission(
        request.tenant.tenantId,
        request.tenant.membershipId,
        permission,
      );
      if (!allowed)
        throw new ProblemError(
          403,
          'AUTHORIZATION_DENIED',
          'Không có quyền thực hiện thao tác này.',
        );
      next();
    } catch (error) {
      next(error);
    }
  };
