import { Router } from 'express';
import {
  createCancellationReasonSchema,
  createBookingRetentionPolicySchema,
  createBookingServiceVersionSchema,
  createCustomerPhotoConsentPolicySchema,
  changeBookingMediaLegalHoldSchema,
  replaceBookingReportDestinationsSchema,
  rerunBookingReportSchema,
} from '@adsup/contracts';
import { readIdempotencyKey, tenantIdempotent } from '../../http/idempotency.js';
import type {
  AuthTenantsRepository,
  GovernanceRepository,
  OrganizationRbacRepository,
} from '@adsup/database';
import type { TokenService } from '../auth/token-service.js';
import {
  authenticate,
  requirePermission,
  tenantContext,
  type AuthenticatedRequest,
} from '../../http/middleware/auth.js';

export interface BookingConfigRoutesDependencies {
  readonly tokens?: TokenService;
  readonly authRepo?: AuthTenantsRepository;
  readonly rbacRepo?: OrganizationRbacRepository;
  readonly governance?: GovernanceRepository;
  readonly configService?: unknown;
  readonly reportService?: {
    listDestinations(input: { tenantId: string; actorMembershipId: string }): Promise<unknown>;
    replaceDestinations(input: Record<string, unknown>): Promise<unknown>;
    rerun(input: Record<string, unknown>): Promise<unknown>;
  };
}

export function bookingConfigRoutes(deps: BookingConfigRoutesDependencies = {}): Router {
  const router = Router();
  if (!deps.tokens || !deps.authRepo || !deps.rbacRepo) return router;
  const auth = authenticate(deps.tokens);
  const scoped = tenantContext(deps.authRepo);
  const configService = deps.configService as
    | {
        listCancellationReasons(input: {
          tenantId: string;
          actorMembershipId: string;
          effectiveAt?: Date;
        }): Promise<unknown>;
        createCancellationReasonVersion(input: Record<string, unknown>): Promise<unknown>;
        createServiceOfferingVersion(input: Record<string, unknown>): Promise<unknown>;
        createCustomerPhotoConsentPolicyVersion(input: Record<string, unknown>): Promise<unknown>;
        getEffectiveCustomerPhotoConsentPolicy(input: Record<string, unknown>): Promise<unknown>;
        createBookingRetentionPolicyVersion(input: Record<string, unknown>): Promise<unknown>;
        getEffectiveBookingRetentionPolicy(input: Record<string, unknown>): Promise<unknown>;
        changeMediaLegalHold(input: Record<string, unknown>): Promise<unknown>;
      }
    | undefined;
  router.get(
    '/tenants/:tenantId/booking-cancellation-reasons',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.read'),
    async (request: AuthenticatedRequest, response) => {
      if (!configService) return response.status(501).json({ code: 'MODULE_NOT_READY' });
      const effectiveAt =
        typeof request.query.effectiveAt === 'string'
          ? new Date(request.query.effectiveAt)
          : undefined;
      return response.json(
        await configService.listCancellationReasons({
          tenantId: request.tenant!.tenantId,
          actorMembershipId: request.tenant!.membershipId,
          effectiveAt,
        }),
      );
    },
  );
  router.post(
    '/tenants/:tenantId/booking-cancellation-reasons',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.config.manage'),
    async (request: AuthenticatedRequest, response) => {
      if (!configService) return response.status(501).json({ code: 'MODULE_NOT_READY' });
      const body = createCancellationReasonSchema.parse(request.body);
      const result = await configService.createCancellationReasonVersion({
        ...body,
        effectiveFrom: new Date(body.effectiveFrom),
        tenantId: request.tenant!.tenantId,
        actorMembershipId: request.tenant!.membershipId,
        correlationId: request.tenant!.correlationId,
      });
      return response.status(201).json(result);
    },
  );
  router.post(
    '/tenants/:tenantId/booking-services',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.config.manage'),
    async (request: AuthenticatedRequest, response) => {
      if (!configService) return response.status(501).json({ code: 'MODULE_NOT_READY' });
      const body = createBookingServiceVersionSchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'booking.service-version.create',
        body,
        () =>
          configService.createServiceOfferingVersion({
            ...body,
            effectiveFrom: new Date(body.effectiveFrom),
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      return response.status(201).json(result);
    },
  );
  router.post(
    '/tenants/:tenantId/customer-photo-consent-policies',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.config.manage'),
    async (request: AuthenticatedRequest, response) => {
      if (!configService) return response.status(501).json({ code: 'MODULE_NOT_READY' });
      const body = createCustomerPhotoConsentPolicySchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'booking.consent-policy.create',
        body,
        () =>
          configService.createCustomerPhotoConsentPolicyVersion({
            ...body,
            effectiveFrom: new Date(body.effectiveFrom),
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      return response.status(201).json(result);
    },
  );
  router.get(
    '/tenants/:tenantId/customer-photo-consent-policies/effective',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.config.read'),
    async (request: AuthenticatedRequest, response) => {
      if (!configService) return response.status(501).json({ code: 'MODULE_NOT_READY' });
      const effectiveAt =
        typeof request.query.effectiveAt === 'string'
          ? new Date(request.query.effectiveAt)
          : undefined;
      return response.json(
        await configService.getEffectiveCustomerPhotoConsentPolicy({
          tenantId: request.tenant!.tenantId,
          actorMembershipId: request.tenant!.membershipId,
          effectiveAt,
        }),
      );
    },
  );
  router.post(
    '/tenants/:tenantId/booking-retention-policies',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.retention.manage'),
    async (request: AuthenticatedRequest, response) => {
      if (!configService) return response.status(501).json({ code: 'MODULE_NOT_READY' });
      const body = createBookingRetentionPolicySchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'booking.retention-policy.create',
        body,
        () =>
          configService.createBookingRetentionPolicyVersion({
            ...body,
            effectiveFrom: new Date(body.effectiveFrom),
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      return response.status(201).json(result);
    },
  );
  router.get(
    '/tenants/:tenantId/booking-retention-policies/effective',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.config.read'),
    async (request: AuthenticatedRequest, response) => {
      if (!configService) return response.status(501).json({ code: 'MODULE_NOT_READY' });
      const effectiveAt =
        typeof request.query.effectiveAt === 'string'
          ? new Date(request.query.effectiveAt)
          : undefined;
      return response.json(
        await configService.getEffectiveBookingRetentionPolicy({
          tenantId: request.tenant!.tenantId,
          actorMembershipId: request.tenant!.membershipId,
          effectiveAt,
        }),
      );
    },
  );
  router.post(
    '/tenants/:tenantId/booking-media/:mediaId/legal-hold',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.legal-hold.manage'),
    async (request: AuthenticatedRequest, response) => {
      if (!configService) return response.status(501).json({ code: 'MODULE_NOT_READY' });
      const body = changeBookingMediaLegalHoldSchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'booking.media-legal-hold.change',
        { mediaId: request.params.mediaId, ...body },
        () =>
          configService.changeMediaLegalHold({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            mediaId: String(request.params.mediaId),
            correlationId: request.tenant!.correlationId,
          }),
      );
      return response.json(result);
    },
  );
  router.get(
    '/tenants/:tenantId/booking-report-destinations',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.config.read'),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.reportService) return response.status(501).json({ code: 'MODULE_NOT_READY' });
      return response.json({
        items: await deps.reportService.listDestinations({
          tenantId: request.tenant!.tenantId,
          actorMembershipId: request.tenant!.membershipId,
        }),
      });
    },
  );
  router.put(
    '/tenants/:tenantId/booking-report-destinations',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'booking.config.manage'),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.reportService) return response.status(501).json({ code: 'MODULE_NOT_READY' });
      const body = replaceBookingReportDestinationsSchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'booking.report-destinations.replace',
        body,
        () =>
          deps.reportService!.replaceDestinations({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      return response.json({ items: result });
    },
  );
  router.post(
    '/tenants/:tenantId/booking-reports:rerun',
    authenticate(deps.tokens),
    tenantContext(deps.authRepo),
    requirePermission(deps.rbacRepo, 'booking.report.rerun'),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.reportService) return response.status(501).json({ code: 'MODULE_NOT_READY' });
      const body = rerunBookingReportSchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'booking.report.rerun',
        body,
        () =>
          deps.reportService!.rerun({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
            idempotencyKey: readIdempotencyKey(request),
          }),
      );
      return response.status(202).json(result);
    },
  );
  return router;
}
