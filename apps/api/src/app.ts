import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { ZodError } from 'zod';
import { ProblemError, problemDocument } from '@adsup/domain';
import type { AppConfig } from '@adsup/config';
import type {
  AuditRepository,
  AuthTenantsRepository,
  ChatNotificationsRepository,
  GovernanceRepository,
  OrganizationRbacRepository,
} from '@adsup/database';
import type { AuthService } from './modules/auth/auth-service.js';
import type { TokenService } from './modules/auth/token-service.js';
import type { TenantService } from './modules/tenants/tenant-service.js';
import type { InvitationService } from './modules/tenants/invitation-service.js';
import type { OrganizationService } from './modules/organization/organization-service.js';
import type { RbacService } from './modules/rbac/rbac-service.js';
import type { FormService } from './modules/forms/form-service.js';
import type { ChatService } from './modules/chat/chat-service.js';
import type { MediaService } from './modules/media/media-service.js';
import type { KpiConfigService } from './modules/kpi/kpi-config-service.js';
import type { KpiPolicyService } from './modules/kpi/kpi-policy-service.js';
import type { KpiReportService } from './modules/kpi/kpi-report-service.js';
import type { KpiProgressService } from './modules/kpi/kpi-progress-service.js';
import type { ActionItemService } from './modules/action-items/action-item-service.js';
import type { ActionItemManagementService } from './modules/action-items/action-item-management-service.js';
import type { KpiEvaluationService } from './modules/kpi/kpi-evaluation-service.js';
import type { KpiPenaltyService } from './modules/kpi/kpi-penalty-service.js';
import type { KpiEvidenceService } from './modules/kpi/kpi-evidence-service.js';
import {
  attendanceRoutes,
  type AttendanceRoutesDependencies,
} from './modules/attendance/attendance-routes.js';
import {
  workflowRoutes,
  type WorkflowRoutesDependencies,
} from './modules/workflows/workflow-routes.js';
import {
  penaltyRoutes,
  type PenaltyRoutesDependencies,
} from './modules/penalties/penalty-routes.js';
import {
  bookingRoutes,
  type BookingRoutesDependencies,
} from './modules/bookings/booking-routes.js';
import {
  bookingConfigRoutes,
  type BookingConfigRoutesDependencies,
} from './modules/bookings/booking-config-routes.js';
import { exportRoutes, type ExportRoutesDependencies } from './modules/bookings/export-routes.js';
import { authRoutes } from './modules/auth/auth-routes.js';
import { tenantRoutes } from './modules/tenants/tenant-routes.js';
import { organizationRoutes } from './modules/organization/organization-routes.js';
import { rbacRoutes } from './modules/rbac/rbac-routes.js';
import { formRoutes } from './modules/forms/form-routes.js';
import { chatRoutes } from './modules/chat/chat-routes.js';
import { notificationRoutes } from './modules/notifications/notification-routes.js';
import { mediaRoutes } from './modules/media/media-routes.js';
import { auditRoutes } from './modules/audit/audit-routes.js';
import { kpiConfigRoutes } from './modules/kpi/kpi-config-routes.js';
import { kpiPolicyRoutes } from './modules/kpi/kpi-policy-routes.js';
import { kpiReportRoutes } from './modules/kpi/kpi-report-routes.js';
import { actionItemRoutes } from './modules/action-items/action-item-routes.js';
import { actionItemManagementRoutes } from './modules/action-items/action-item-management-routes.js';
import { kpiEvaluationRoutes } from './modules/kpi/kpi-evaluation-routes.js';
import { kpiPenaltyRoutes } from './modules/kpi/kpi-penalty-routes.js';
import { kpiEvidenceRoutes } from './modules/kpi/kpi-evidence-routes.js';
import { Metrics, createLogger } from './observability/index.js';

export interface AppDependencies {
  config: AppConfig;
  authService: AuthService;
  tokens: TokenService;
  authRepo: AuthTenantsRepository;
  tenantService: TenantService;
  invitationService: InvitationService;
  organizationService: OrganizationService;
  rbacService: RbacService;
  rbacRepo: OrganizationRbacRepository;
  formService: FormService;
  chatService: ChatService;
  chatRepo: ChatNotificationsRepository;
  mediaService: MediaService;
  auditRepo: AuditRepository;
  governance?: GovernanceRepository;
  kpiConfigService?: KpiConfigService;
  kpiPolicyService?: KpiPolicyService;
  kpiReportService?: KpiReportService;
  kpiProgressService?: KpiProgressService;
  actionItemService?: ActionItemService;
  actionItemManagementService?: ActionItemManagementService;
  kpiEvaluationService?: KpiEvaluationService;
  kpiPenaltyService?: KpiPenaltyService;
  kpiEvidenceService?: KpiEvidenceService;
  attendance?: AttendanceRoutesDependencies;
  workflows?: WorkflowRoutesDependencies;
  penalties?: PenaltyRoutesDependencies;
  bookings?: BookingRoutesDependencies;
  bookingConfig?: BookingConfigRoutesDependencies;
  bookingExports?: ExportRoutesDependencies;
  metrics?: Metrics;
  readiness?: () => Promise<boolean>;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();
  const logger = createLogger(deps.config);
  const metrics = deps.metrics ?? new Metrics();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use((request, response, next) => {
    const startedAt = performance.now();
    const correlationId = request.header('x-correlation-id') ?? randomUUID();
    request.headers['x-correlation-id'] = correlationId;
    response.setHeader('x-correlation-id', correlationId);
    response.once('finish', () => {
      metrics.increment('http_requests_total');
      metrics.increment(`http_status_${response.statusCode}_total`);
      if (response.statusCode === 401) metrics.increment('authentication_denials_total');
      if (response.statusCode === 403) metrics.increment('authorization_denials_total');
      metrics.observe('http_request_duration_ms', performance.now() - startedAt);
    });
    next();
  });
  app.get('/health/live', (_request, response) =>
    response.json({ status: 'ok', timestamp: new Date() }),
  );
  app.get('/health/ready', async (_request, response) => {
    const ready = await (deps.readiness?.() ?? Promise.resolve(true));
    response.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'degraded',
      timestamp: new Date(),
      dependencies: { database: ready ? 'ok' : 'degraded' },
    });
  });
  app.get('/internal/metrics', (_request, response) => response.json(metrics.snapshot()));
  app.use('/v1', authRoutes(deps.authService, deps.tokens, deps.governance));
  app.use(
    '/v1',
    tenantRoutes(
      deps.tokens,
      deps.tenantService,
      deps.invitationService,
      deps.authRepo,
      deps.rbacRepo,
      deps.governance,
    ),
  );
  app.use(
    '/v1',
    organizationRoutes(
      deps.tokens,
      deps.organizationService,
      deps.authRepo,
      deps.rbacRepo,
      deps.governance,
    ),
  );
  app.use(
    '/v1',
    rbacRoutes(
      deps.tokens,
      deps.rbacService,
      deps.organizationService,
      deps.authRepo,
      deps.rbacRepo,
      deps.governance,
    ),
  );
  app.use(
    '/v1',
    formRoutes(deps.tokens, deps.formService, deps.authRepo, deps.rbacRepo, deps.governance),
  );
  app.use(
    '/v1',
    chatRoutes(deps.tokens, deps.chatService, deps.authRepo, deps.rbacRepo, deps.governance),
  );
  app.use(
    '/v1',
    notificationRoutes(deps.tokens, deps.chatRepo, deps.config.jwtAccessSecret, deps.governance),
  );
  app.use(
    '/v1',
    mediaRoutes(deps.tokens, deps.mediaService, deps.authRepo, deps.rbacRepo, deps.governance),
  );
  app.use('/v1', auditRoutes(deps.tokens, deps.auditRepo, deps.authRepo, deps.rbacRepo));
  if (deps.kpiConfigService) {
    app.use(
      '/v1',
      kpiConfigRoutes(
        deps.tokens,
        deps.kpiConfigService,
        deps.authRepo,
        deps.rbacRepo,
        deps.governance,
      ),
    );
  }
  if (deps.kpiPolicyService) {
    app.use(
      '/v1',
      kpiPolicyRoutes(
        deps.tokens,
        deps.kpiPolicyService,
        deps.authRepo,
        deps.rbacRepo,
        deps.governance,
      ),
    );
  }
  if (deps.kpiReportService && deps.kpiProgressService) {
    app.use(
      '/v1',
      kpiReportRoutes(
        deps.tokens,
        deps.kpiReportService,
        deps.kpiProgressService,
        deps.authRepo,
        deps.rbacRepo,
        deps.governance,
      ),
    );
  }
  if (deps.actionItemService) {
    app.use(
      '/v1',
      actionItemRoutes(deps.tokens, deps.actionItemService, deps.authRepo, deps.rbacRepo),
    );
  }
  if (deps.actionItemManagementService) {
    app.use(
      '/v1',
      actionItemManagementRoutes(
        deps.tokens,
        deps.actionItemManagementService,
        deps.authRepo,
        deps.rbacRepo,
      ),
    );
  }
  if (deps.kpiEvaluationService) {
    app.use(
      '/v1',
      kpiEvaluationRoutes(
        deps.tokens,
        deps.kpiEvaluationService,
        deps.authRepo,
        deps.rbacRepo,
        deps.governance,
      ),
    );
  }
  if (deps.kpiPenaltyService) {
    app.use(
      '/v1',
      kpiPenaltyRoutes(
        deps.tokens,
        deps.kpiPenaltyService,
        deps.authRepo,
        deps.rbacRepo,
        deps.governance,
      ),
    );
  }
  if (deps.kpiEvidenceService) {
    app.use(
      '/v1',
      kpiEvidenceRoutes(
        deps.tokens,
        deps.kpiEvidenceService,
        deps.authRepo,
        deps.rbacRepo,
        deps.governance,
      ),
    );
  }
  if (deps.attendance) {
    app.use(
      '/v1',
      attendanceRoutes({
        ...deps.attendance,
        tokens: deps.tokens,
        authRepo: deps.authRepo,
        rbacRepo: deps.rbacRepo,
        governance: deps.governance,
      }),
    );
  }
  if (deps.workflows) {
    app.use(
      '/v1',
      workflowRoutes({
        ...deps.workflows,
        tokens: deps.tokens,
        authRepo: deps.authRepo,
        rbacRepo: deps.rbacRepo,
        governance: deps.governance,
      }),
    );
  }
  if (deps.penalties) {
    app.use(
      '/v1',
      penaltyRoutes({
        ...deps.penalties,
        tokens: deps.tokens,
        authRepo: deps.authRepo,
        rbacRepo: deps.rbacRepo,
        governance: deps.governance,
      }),
    );
  }
  if (deps.bookings) {
    app.use(
      '/v1',
      bookingRoutes({
        ...deps.bookings,
        tokens: deps.tokens,
        authRepo: deps.authRepo,
        rbacRepo: deps.rbacRepo,
        governance: deps.governance,
      }),
    );
  }
  if (deps.bookingConfig) {
    app.use(
      '/v1',
      bookingConfigRoutes({
        ...deps.bookingConfig,
        tokens: deps.tokens,
        authRepo: deps.authRepo,
        rbacRepo: deps.rbacRepo,
        governance: deps.governance,
      }),
    );
  }
  if (deps.bookingExports) {
    app.use(
      '/v1',
      exportRoutes({
        ...deps.bookingExports,
        tokens: deps.tokens,
        authRepo: deps.authRepo,
        rbacRepo: deps.rbacRepo,
        governance: deps.governance,
      }),
    );
  }
  const errors: ErrorRequestHandler = (error, request, response, _next) => {
    const correlationId = request.header('x-correlation-id') ?? randomUUID();
    const caught: unknown = error;
    const normalized =
      caught instanceof ZodError
        ? new ProblemError(
            422,
            'VALIDATION_FAILED',
            'Dữ liệu đầu vào không hợp lệ.',
            caught.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
          )
        : caught;
    const problem = problemDocument(normalized, correlationId);
    if (problem.status >= 500) {
      logger.error(
        {
          errorName: normalized instanceof Error ? normalized.name : 'UnknownError',
          problemCode: problem.code,
          correlationId,
        },
        'request failed',
      );
    }
    response.status(problem.status).type('application/problem+json').json(problem);
  };
  app.use(errors);
  return app;
}
