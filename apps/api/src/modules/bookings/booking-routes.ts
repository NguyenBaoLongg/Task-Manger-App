import { Router } from 'express';
import {
  bookingQuerySchema,
  completeTourSchema,
  createCustomerSchema,
  createCustomerPhotoConsentSchema,
  createCustomerPhotoUploadIntentSchema,
  createScheduledBookingSchema,
  createWalkInBookingSchema,
  recordBookingOutcomeSchema,
  rescheduleBookingSchema,
  customerQuerySchema,
  effectiveServiceQuerySchema,
  photoDebtQuerySchema,
  recordArrivalSchema,
  updateCustomerSchema,
} from '@adsup/contracts';
import type {
  AuthTenantsRepository,
  GovernanceRepository,
  OrganizationRbacRepository,
} from '@adsup/database';
import type { TokenService } from '../auth/token-service.js';
import type { CustomerService } from './customer-service.js';
import type { BookingService } from './booking-service.js';
import type { ArrivalService } from './arrival-service.js';
import {
  authenticate,
  requireAnyScopedPermission,
  requirePermission,
  tenantContext,
  type AuthenticatedRequest,
} from '../../http/middleware/auth.js';
import { readIdempotencyKey, tenantIdempotent } from '../../http/idempotency.js';
import { kpiJsonSafe } from '../kpi/kpi-http.js';

export interface BookingRoutesDependencies {
  readonly tokens?: TokenService;
  readonly authRepo?: AuthTenantsRepository;
  readonly rbacRepo?: OrganizationRbacRepository;
  readonly governance?: GovernanceRepository;
  readonly customerService?: CustomerService;
  readonly bookingService?: BookingService;
  readonly arrivalService?: ArrivalService;
}

export function bookingRoutes(deps: BookingRoutesDependencies = {}): Router {
  const router = Router();
  if (!deps.tokens || !deps.authRepo || !deps.rbacRepo) return router;
  const auth = authenticate(deps.tokens);
  const scoped = tenantContext(deps.authRepo);
  const unavailable = (
    _request: unknown,
    response: { status(code: number): { json(body: unknown): void } },
  ) => response.status(501).json({ code: 'MODULE_NOT_READY' });

  router.get(
    '/tenants/:tenantId/customers',
    auth,
    scoped,
    requireAnyScopedPermission(deps.rbacRepo, 'booking.customer.read'),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.customerService) return unavailable(request, response);
      const query = customerQuerySchema.parse(request.query);
      return response.json(
        kpiJsonSafe(
          await deps.customerService.list({
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            ...query,
          }),
        ),
      );
    },
  );
  router.post(
    '/tenants/:tenantId/bookings:walk-in',
    auth,
    scoped,
    requirePermission(
      deps.rbacRepo,
      'booking.manage',
      (request) => request.body?.branchId as string | undefined,
    ),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.arrivalService) return unavailable(request, response);
      const body = createWalkInBookingSchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'booking.walk-in.create',
        body,
        () =>
          deps.arrivalService!.createWalkIn({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
            idempotencyKey: readIdempotencyKey(request),
          }),
      );
      return response.status(201).json(kpiJsonSafe(result));
    },
  );
  router.post(
    '/tenants/:tenantId/bookings/:bookingId/outcomes',
    auth,
    scoped,
    requireAnyScopedPermission(deps.rbacRepo, 'booking.outcome.manage'),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.bookingService) return unavailable(request, response);
      const body = recordBookingOutcomeSchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'booking.outcome.record',
        { bookingId: request.params.bookingId, ...body },
        () =>
          deps.bookingService!.recordOutcome({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            bookingId: String(request.params.bookingId),
            correlationId: request.tenant!.correlationId,
          }),
      );
      return response.json(kpiJsonSafe(result));
    },
  );
  router.post(
    '/tenants/:tenantId/bookings/:bookingId/reschedules',
    auth,
    scoped,
    requireAnyScopedPermission(deps.rbacRepo, 'booking.manage'),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.bookingService) return unavailable(request, response);
      const body = rescheduleBookingSchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'booking.reschedule',
        { bookingId: request.params.bookingId, ...body },
        () =>
          deps.bookingService!.reschedule({
            ...body,
            scheduledStartAt: new Date(body.scheduledStartAt),
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            bookingId: String(request.params.bookingId),
            correlationId: request.tenant!.correlationId,
          }),
      );
      return response.status(201).json(kpiJsonSafe(result));
    },
  );
  router.post(
    '/tenants/:tenantId/customers',
    auth,
    scoped,
    requireAnyScopedPermission(deps.rbacRepo, 'booking.customer.manage'),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.customerService) return unavailable(request, response);
      const body = createCustomerSchema.parse(request.body);
      const customer = await tenantIdempotent(
        deps.governance,
        request,
        'booking.customer.create',
        body,
        () =>
          deps.customerService!.create({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      return response.status(201).json(kpiJsonSafe(customer));
    },
  );
  router.get(
    '/tenants/:tenantId/customers/:customerId',
    auth,
    scoped,
    requireAnyScopedPermission(deps.rbacRepo, 'booking.customer.read'),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.customerService) return unavailable(request, response);
      return response.json(
        kpiJsonSafe(
          await deps.customerService.get({
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            customerId: String(request.params.customerId),
          }),
        ),
      );
    },
  );
  router.patch(
    '/tenants/:tenantId/customers/:customerId',
    auth,
    scoped,
    requireAnyScopedPermission(deps.rbacRepo, 'booking.customer.manage'),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.customerService) return unavailable(request, response);
      const body = updateCustomerSchema.parse(request.body);
      const customer = await tenantIdempotent(
        deps.governance,
        request,
        'booking.customer.update',
        { customerId: request.params.customerId, ...body },
        () =>
          deps.customerService!.update({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
            customerId: String(request.params.customerId),
            reason: 'CUSTOMER_PROFILE_UPDATED',
          }),
      );
      return response.json(kpiJsonSafe(customer));
    },
  );
  router.get(
    '/tenants/:tenantId/booking-services',
    auth,
    scoped,
    requireAnyScopedPermission(deps.rbacRepo, 'booking.read'),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.bookingService) return unavailable(request, response);
      const query = effectiveServiceQuerySchema.parse(request.query);
      const items = await deps.bookingService.listEffectiveServices({
        tenantId: request.tenant!.tenantId,
        actorMembershipId: request.tenant!.membershipId,
        branchId: query.branchId,
        effectiveAt: query.effectiveAt ? new Date(query.effectiveAt) : undefined,
      });
      return response.json(kpiJsonSafe({ items }));
    },
  );
  router.get(
    '/tenants/:tenantId/bookings',
    auth,
    scoped,
    requireAnyScopedPermission(deps.rbacRepo, 'booking.read'),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.bookingService) return unavailable(request, response);
      const query = bookingQuerySchema.parse(request.query);
      return response.json(
        kpiJsonSafe(
          await deps.bookingService.list({
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            ...query,
          }),
        ),
      );
    },
  );
  router.post(
    '/tenants/:tenantId/bookings',
    auth,
    scoped,
    requirePermission(
      deps.rbacRepo,
      'booking.manage',
      (request) => request.body?.branchId as string | undefined,
    ),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.bookingService) return unavailable(request, response);
      const body = createScheduledBookingSchema.parse(request.body);
      const booking = await tenantIdempotent(
        deps.governance,
        request,
        'booking.scheduled.create',
        body,
        () =>
          deps.bookingService!.createScheduled({
            ...body,
            scheduledStartAt: new Date(body.scheduledStartAt),
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
            idempotencyKey: readIdempotencyKey(request),
          }),
      );
      return response.status(201).json(kpiJsonSafe(booking));
    },
  );
  router.get(
    '/tenants/:tenantId/bookings/:bookingId',
    auth,
    scoped,
    requireAnyScopedPermission(deps.rbacRepo, 'booking.read'),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.bookingService) return unavailable(request, response);
      return response.json(
        kpiJsonSafe(
          await deps.bookingService.get({
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            bookingId: String(request.params.bookingId),
          }),
        ),
      );
    },
  );
  router.post(
    '/tenants/:tenantId/bookings/:bookingId/customer-photo-consents',
    auth,
    scoped,
    requireAnyScopedPermission(deps.rbacRepo, 'booking.arrival.manage'),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.arrivalService) return unavailable(request, response);
      const body = createCustomerPhotoConsentSchema.parse(request.body);
      const consent = await tenantIdempotent(
        deps.governance,
        request,
        'booking.customer-photo-consent.create',
        { bookingId: request.params.bookingId, ...body },
        () =>
          deps.arrivalService!.recordConsent({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            bookingId: String(request.params.bookingId),
            correlationId: request.tenant!.correlationId,
          }),
      );
      return response.status(201).json(kpiJsonSafe(consent));
    },
  );
  router.post(
    '/tenants/:tenantId/bookings/:bookingId/customer-photo-upload-intents',
    auth,
    scoped,
    requireAnyScopedPermission(deps.rbacRepo, 'booking.arrival.manage'),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.arrivalService) return unavailable(request, response);
      const body = createCustomerPhotoUploadIntentSchema.parse(request.body);
      const intent = await tenantIdempotent(
        deps.governance,
        request,
        'booking.customer-photo-upload-intent.create',
        { bookingId: request.params.bookingId, ...body },
        () =>
          deps.arrivalService!.createCustomerPhotoUploadIntent({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            bookingId: String(request.params.bookingId),
            correlationId: request.tenant!.correlationId,
          }),
      );
      return response.status(201).json(kpiJsonSafe(intent));
    },
  );
  router.post(
    '/tenants/:tenantId/bookings/:bookingId/arrivals',
    auth,
    scoped,
    requireAnyScopedPermission(deps.rbacRepo, 'booking.arrival.manage'),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.arrivalService) return unavailable(request, response);
      const body = recordArrivalSchema.parse(request.body);
      return response.json(
        kpiJsonSafe(
          await tenantIdempotent(
            deps.governance,
            request,
            'booking.arrival.record',
            { bookingId: request.params.bookingId, ...body },
            () =>
              deps.arrivalService!.recordArrival({
                ...body,
                tenantId: request.tenant!.tenantId,
                actorMembershipId: request.tenant!.membershipId,
                bookingId: String(request.params.bookingId),
                correlationId: request.tenant!.correlationId,
              }),
          ),
        ),
      );
    },
  );
  router.get(
    '/tenants/:tenantId/booking-photo-debts',
    auth,
    scoped,
    requireAnyScopedPermission(deps.rbacRepo, 'booking.photo-debt.read'),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.arrivalService) return unavailable(request, response);
      const query = photoDebtQuerySchema.parse(request.query);
      return response.json(
        kpiJsonSafe(
          await deps.arrivalService.listPhotoDebts({
            ...query,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
          }),
        ),
      );
    },
  );
  router.post(
    '/tenants/:tenantId/bookings/:bookingId/tour-completions',
    auth,
    scoped,
    requireAnyScopedPermission(deps.rbacRepo, 'booking.tour.complete'),
    async (request: AuthenticatedRequest, response) => {
      if (!deps.arrivalService) return unavailable(request, response);
      const body = completeTourSchema.parse(request.body);
      const completion = await tenantIdempotent(
        deps.governance,
        request,
        'booking.tour.complete',
        { bookingId: request.params.bookingId, ...body },
        () =>
          deps.arrivalService!.completeTour({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            bookingId: String(request.params.bookingId),
            correlationId: request.tenant!.correlationId,
          }),
      );
      return response.status(201).json(kpiJsonSafe(completion));
    },
  );
  return router;
}
