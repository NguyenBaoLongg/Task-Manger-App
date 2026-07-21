import { Router } from 'express';
import {
  acknowledgeVideoPolicySchema,
  createCheckInRequestSchema,
  createOffCalendarRequestSchema,
  createVideoPolicyRequestSchema,
  monthlySummaryQuerySchema,
  scheduleQuerySchema,
  selfScheduleRequestSchema,
  videoReviewRequestSchema,
} from '@adsup/contracts';
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
import { tenantIdempotent } from '../../http/idempotency.js';
import { kpiJsonSafe } from '../kpi/kpi-http.js';

export interface AttendanceRoutesDependencies {
  readonly tokens?: TokenService;
  readonly authRepo?: AuthTenantsRepository;
  readonly rbacRepo?: OrganizationRbacRepository;
  readonly governance?: GovernanceRepository;
  readonly scheduleService?: {
    listShifts(input: { tenantId: string; cursor?: string }): Promise<unknown>;
    listSchedules(input: {
      tenantId: string;
      branchId?: string;
      membershipId?: string;
      dateFrom: string;
      dateTo: string;
      cursor?: string;
    }): Promise<unknown>;
    createOrEditMySchedule(input: {
      tenantId: string;
      actorMembershipId: string;
      correlationId: string;
      businessDate: string;
      shiftDefinitionId: string;
      reason?: string;
    }): Promise<unknown>;
  };
  readonly attendanceService?: {
    createVideoPolicyVersion(input: Record<string, unknown>): Promise<unknown>;
    acknowledgeVideoPolicy(input: Record<string, unknown>): Promise<unknown>;
    createCheckIn(input: Record<string, unknown>): Promise<unknown>;
  };
  readonly videoReviewService?: {
    review(input: Record<string, unknown>): Promise<unknown>;
  };
  readonly offCalendarService?: {
    createVersion(input: Record<string, unknown>): Promise<unknown>;
  };
  readonly absenceService?: {
    listMonthlySummaries(input: Record<string, unknown>): Promise<unknown>;
  };
}

export function attendanceRoutes(deps: AttendanceRoutesDependencies = {}): Router {
  const router = Router();
  if (!deps.tokens || !deps.authRepo || !deps.rbacRepo) return router;
  const auth = authenticate(deps.tokens);
  const scoped = tenantContext(deps.authRepo);

  router.get(
    '/tenants/:tenantId/attendance/shifts',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'attendance.schedule.self'),
    async (request: AuthenticatedRequest, response) => {
      const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined;
      response.json(
        kpiJsonSafe(
          await deps.scheduleService!.listShifts({
            tenantId: request.tenant!.tenantId,
            cursor,
          }),
        ),
      );
    },
  );

  router.get(
    '/tenants/:tenantId/attendance/schedules',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'attendance.schedule.manage', (request) =>
      typeof request.query.branchId === 'string' ? request.query.branchId : undefined,
    ),
    async (request: AuthenticatedRequest, response) => {
      const query = scheduleQuerySchema.parse(request.query);
      response.json(
        kpiJsonSafe(
          await deps.scheduleService!.listSchedules({
            tenantId: request.tenant!.tenantId,
            ...query,
          }),
        ),
      );
    },
  );

  router.post(
    '/tenants/:tenantId/attendance/schedules',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'attendance.schedule.self'),
    async (request: AuthenticatedRequest, response) => {
      const body = selfScheduleRequestSchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'attendance.schedule.self',
        body,
        () =>
          deps.scheduleService!.createOrEditMySchedule({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      response.status(201).json(kpiJsonSafe(result));
    },
  );

  router.post(
    '/tenants/:tenantId/attendance/off-calendar',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'attendance.off-calendar.manage', (request) => {
      const body = request.body as { branchId?: unknown };
      return typeof body.branchId === 'string' ? body.branchId : undefined;
    }),
    async (request: AuthenticatedRequest, response) => {
      const body = createOffCalendarRequestSchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'attendance.off-calendar.create',
        body,
        () =>
          deps.offCalendarService!.createVersion({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      response.status(201).json(kpiJsonSafe(result));
    },
  );

  router.post(
    '/tenants/:tenantId/attendance/video-policies',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'attendance.video-policy.manage', (request) => {
      const body = request.body as { branchId?: unknown };
      return typeof body.branchId === 'string' ? body.branchId : undefined;
    }),
    async (request: AuthenticatedRequest, response) => {
      const body = createVideoPolicyRequestSchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'attendance.video-policy.create',
        body,
        () =>
          deps.attendanceService!.createVideoPolicyVersion({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      response.status(201).json(kpiJsonSafe(result));
    },
  );

  router.post(
    '/tenants/:tenantId/attendance/video-policy/acknowledgements',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'attendance.schedule.self'),
    async (request: AuthenticatedRequest, response) => {
      const body = acknowledgeVideoPolicySchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'attendance.video-policy.ack',
        body,
        () =>
          deps.attendanceService!.acknowledgeVideoPolicy({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      response.status(201).json(kpiJsonSafe(result));
    },
  );

  router.post(
    '/tenants/:tenantId/attendance/check-ins',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'attendance.schedule.self'),
    async (request: AuthenticatedRequest, response) => {
      const body = createCheckInRequestSchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'attendance.check-in.create',
        body,
        () =>
          deps.attendanceService!.createCheckIn({
            ...body,
            tenantId: request.tenant!.tenantId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      response.status(201).json(kpiJsonSafe(result));
    },
  );

  router.post(
    '/tenants/:tenantId/attendance/check-ins/:attendanceEventId/review',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'attendance.video.review'),
    async (request: AuthenticatedRequest, response) => {
      const body = videoReviewRequestSchema.parse(request.body);
      const result = await tenantIdempotent(
        deps.governance,
        request,
        'attendance.video-review.create',
        body,
        () =>
          deps.videoReviewService!.review({
            ...body,
            tenantId: request.tenant!.tenantId,
            attendanceEventId: request.params.attendanceEventId,
            actorMembershipId: request.tenant!.membershipId,
            correlationId: request.tenant!.correlationId,
          }),
      );
      response.json(kpiJsonSafe(result));
    },
  );

  router.get(
    '/tenants/:tenantId/attendance/absences/monthly-summary',
    auth,
    scoped,
    requirePermission(deps.rbacRepo, 'attendance.leave.manage', (request) =>
      typeof request.query.branchId === 'string' ? request.query.branchId : undefined,
    ),
    async (request: AuthenticatedRequest, response) => {
      const query = monthlySummaryQuerySchema.parse(request.query);
      response.json(
        kpiJsonSafe(
          await deps.absenceService!.listMonthlySummaries({
            tenantId: request.tenant!.tenantId,
            ...query,
          }),
        ),
      );
    },
  );

  return router;
}
