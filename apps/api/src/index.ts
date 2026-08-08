import { createServer } from 'node:http';
import type { Server as SocketServer } from 'socket.io';
import { parseConfig } from '@adsup/config';
import {
  AuditRepository,
  AttendanceRepository,
  AttendanceWorkerRepository,
  AuthTenantsRepository,
  ChatNotificationsRepository,
  FormsRepository,
  GovernanceRepository,
  KpiRepository,
  ActionItemRepository,
  KpiWorkerRepository,
  KpiEvidenceRepository,
  MediaRepository,
  OrganizationRbacRepository,
  PenaltyRepository,
  WorkflowRepository,
  BookingRepository,
  BookingWorkerRepository,
  ExportRepository,
  createDatabaseClient,
} from '@adsup/database';
import { ProblemError, type RealtimePort } from '@adsup/domain';
import { createApp } from './app.js';
import { createGoogleVerifier } from './modules/auth/google-verifier.js';
import { TokenService } from './modules/auth/token-service.js';
import { AuthService } from './modules/auth/auth-service.js';
import { TenantService } from './modules/tenants/tenant-service.js';
import { InvitationService } from './modules/tenants/invitation-service.js';
import { OrganizationService } from './modules/organization/organization-service.js';
import { RbacService } from './modules/rbac/rbac-service.js';
import { FormValidator } from './modules/forms/form-validator.js';
import { FormService } from './modules/forms/form-service.js';
import { ChatService } from './modules/chat/chat-service.js';
import { MediaService } from './modules/media/media-service.js';
import { MemoryObjectStorage, S3ObjectStorage } from './modules/media/s3-object-storage.js';
import { LocalExportDownloadStorage } from './modules/bookings/export-local-storage.js';
import { createSocketGateway } from './realtime/socket-gateway.js';
import { configureBackplane } from './realtime/backplane.js';
import { Metrics, createLogger } from './observability/index.js';
import { KpiConfigService } from './modules/kpi/kpi-config-service.js';
import { KpiPolicyService } from './modules/kpi/kpi-policy-service.js';
import { KpiReportService } from './modules/kpi/kpi-report-service.js';
import { KpiSourceService } from './modules/kpi/kpi-source-service.js';
import { KpiProgressService } from './modules/kpi/kpi-progress-service.js';
import { ActionItemService } from './modules/action-items/action-item-service.js';
import { KpiEvaluationService } from './modules/kpi/kpi-evaluation-service.js';
import { KpiPenaltyService } from './modules/kpi/kpi-penalty-service.js';
import { KpiEvidenceService } from './modules/kpi/kpi-evidence-service.js';
import { ActionItemManagementService } from './modules/action-items/action-item-management-service.js';
import { ScheduleService } from './modules/attendance/schedule-service.js';
import { AttendanceService } from './modules/attendance/attendance-service.js';
import { VideoReviewService } from './modules/attendance/video-review-service.js';
import { AbsenceService, LeaveService } from './modules/attendance/leave-service.js';
import { OffCalendarService } from './modules/attendance/off-calendar-service.js';
import { WorkflowEffects } from './modules/workflows/workflow-effects.js';
import { WorkflowService } from './modules/workflows/workflow-service.js';
import { PenaltyService } from './modules/penalties/penalty-service.js';
import { CustomerService } from './modules/bookings/customer-service.js';
import { BookingService } from './modules/bookings/booking-service.js';
import { ArrivalService } from './modules/bookings/arrival-service.js';
import { BookingKpiSourceService } from './modules/bookings/booking-kpi-source-service.js';
import { BookingConfigService } from './modules/bookings/booking-config-service.js';
import { BookingReportService } from './modules/bookings/booking-report-service.js';
import { ExportService } from './modules/bookings/export-service.js';

const config = parseConfig(process.env);
const logger = createLogger(config);
const metrics = new Metrics();
const database = createDatabaseClient(config.databaseUrl);
const authRepo = new AuthTenantsRepository(database);
const rbacRepo = new OrganizationRbacRepository(database);
const formsRepo = new FormsRepository(database);
const chatRepo = new ChatNotificationsRepository(database);
const mediaRepo = new MediaRepository(database);
const auditRepo = new AuditRepository(database);
const governance = new GovernanceRepository(database, config.jwtAccessSecret, metrics);
const kpiRepo = new KpiRepository(database);
const attendanceRepo = new AttendanceRepository(database);
const bookingRepo = new BookingRepository(database);
const penaltyRepo = new PenaltyRepository(database);
const kpiConfigService = new KpiConfigService(kpiRepo);
const kpiPolicyService = new KpiPolicyService(kpiRepo);
const kpiReportService = new KpiReportService(kpiRepo);
const actionItemRepo = new ActionItemRepository(database);
const actionItemService = new ActionItemService(actionItemRepo);
const actionItemManagementService = new ActionItemManagementService(actionItemRepo);
const kpiSourceService = new KpiSourceService(
  {
    async read() {
      return null;
    },
  },
  attendanceRepo,
  new BookingKpiSourceService(bookingRepo),
);
const kpiEvidenceService = new KpiEvidenceService(
  new KpiEvidenceRepository(database),
  kpiRepo,
  new ActionItemRepository(database),
);
const kpiProgressService = new KpiProgressService(
  kpiRepo,
  kpiReportService,
  kpiSourceService,
  actionItemService,
  kpiEvidenceService,
);
const kpiEvaluationService = new KpiEvaluationService(kpiRepo, new KpiWorkerRepository(database));
const kpiPenaltyService = new KpiPenaltyService(kpiRepo);
const scheduleService = new ScheduleService(attendanceRepo, undefined, actionItemRepo);
const attendanceService = new AttendanceService(attendanceRepo, undefined, penaltyRepo);
const videoReviewService = new VideoReviewService(attendanceRepo, penaltyRepo);
const leaveService = new LeaveService(attendanceRepo, undefined, penaltyRepo);
const offCalendarService = new OffCalendarService(attendanceRepo);
const absenceService = new AbsenceService(attendanceRepo);
const workflowService = new WorkflowService(
  new WorkflowRepository(database),
  new WorkflowEffects(leaveService, attendanceRepo, penaltyRepo),
  undefined,
  leaveService,
);
const penaltyService = new PenaltyService(penaltyRepo, actionItemRepo);
const attendanceWorkerRepo = new AttendanceWorkerRepository(database);
const customerService = new CustomerService(bookingRepo, rbacRepo);
const bookingService = new BookingService(bookingRepo, rbacRepo, new FormValidator(), metrics);
const bookingConfigService = new BookingConfigService(bookingRepo, rbacRepo);
const bookingWorkerRepo = new BookingWorkerRepository(database);
type BookingReportDestinationInput = {
  tenantId: string;
  actorMembershipId: string;
  correlationId: string;
  items: Array<{
    branchId?: string;
    reportType: 'TOMORROW_SCHEDULE' | 'TODAY_OUTCOME';
    chatChannelId: string;
  }>;
};
type BookingReportRerunInput = {
  tenantId: string;
  actorMembershipId: string;
  correlationId: string;
  reportType: 'TOMORROW_SCHEDULE' | 'TODAY_OUTCOME';
  businessDate: Date;
  branchIds?: string[];
  reason: string;
};
const bookingReportService = new BookingReportService(
  {
    listBookingReportDestinations: (input: { tenantId: string }) =>
      bookingRepo.listBookingReportDestinations(input),
    replaceBookingReportDestinations: (input: BookingReportDestinationInput) =>
      bookingRepo.replaceBookingReportDestinations(input),
    enqueueReportRerun: (input: BookingReportRerunInput) =>
      bookingWorkerRepo.enqueueReportRerun(input),
  },
  rbacRepo,
);
const exportRepo = new ExportRepository(database);
const notImplemented = () => {
  throw new ProblemError(
    422,
    'BUSINESS_RULE_VIOLATION',
    'Module 3 service chÆ°a Ä‘Æ°á»£c kÃ­ch hoáº¡t cho thao tÃ¡c nÃ y.',
  );
};
void attendanceWorkerRepo;
void bookingWorkerRepo;
void exportRepo;
void notImplemented;
const tokens = new TokenService(
  config.jwtAccessSecret,
  config.jwtIssuer,
  config.jwtAudience,
  config.accessTokenTtlSeconds,
  config.refreshTokenTtlSeconds,
  authRepo,
);
const authService = new AuthService(
  createGoogleVerifier(config.authGoogleMode, config.googleClientId),
  authRepo,
  tokens,
);
const tenantService = new TenantService(authRepo);
const invitationService = new InvitationService(authRepo);
const organizationService = new OrganizationService(rbacRepo);
const rbacService = new RbacService(rbacRepo);
const formService = new FormService(formsRepo, new FormValidator());

const socketHolder: { current?: SocketServer } = {};
const realtime: RealtimePort = {
  async publish(room, event, payload) {
    socketHolder.current?.to(room).emit(event, payload);
  },
};
const chatService = new ChatService(chatRepo, rbacRepo, realtime);
const storage =
  config.objectStorageDriver === 's3'
    ? new S3ObjectStorage(config.s3.bucket, config.s3)
    : new MemoryObjectStorage();
const exportDownloadStorage =
  config.objectStorageDriver === 's3' ? storage : new LocalExportDownloadStorage();
const mediaService = new MediaService(
  mediaRepo,
  storage,
  config.s3.bucket || 'adsup-local',
  config.signedUrlTtlSeconds,
  rbacRepo,
  metrics,
);
const exportService = new ExportService(exportRepo, rbacRepo, exportDownloadStorage);
const arrivalService = new ArrivalService(bookingRepo, rbacRepo, new FormValidator(), mediaService);

const app = createApp({
  config,
  authService,
  tokens,
  authRepo,
  tenantService,
  invitationService,
  organizationService,
  rbacService,
  rbacRepo,
  formService,
  chatService,
  chatRepo,
  mediaService,
  auditRepo,
  governance,
  kpiConfigService,
  kpiPolicyService,
  kpiReportService,
  kpiProgressService,
  actionItemService,
  actionItemManagementService,
  kpiEvaluationService,
  kpiPenaltyService,
  kpiEvidenceService,
  attendance: {
    scheduleService,
    attendanceService,
    videoReviewService,
    offCalendarService,
    absenceService,
  },
  workflows: {
    workflowService,
  },
  penalties: {
    penaltyService,
  },
  bookings: {
    customerService,
    bookingService,
    arrivalService,
  },
  bookingConfig: { configService: bookingConfigService, reportService: bookingReportService },
  bookingExports: { exportService },
  metrics,
  readiness: async () => {
    try {
      await database.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  },
});
const http = createServer(app);
socketHolder.current = createSocketGateway(
  http,
  tokens,
  authRepo,
  chatRepo,
  chatService,
  rbacRepo,
  metrics,
);
const closeBackplane = await configureBackplane(
  socketHolder.current,
  config.realtimeBackplane,
  config.redisUrl,
  metrics,
);

http.listen(config.port, () => logger.info({ port: config.port }, 'adsup api listening'));

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  await closeBackplane();
  await socketHolder.current?.close();
  http.close();
  await database.$disconnect();
}
process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
