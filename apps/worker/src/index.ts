import { createServer } from 'node:http';
import { parseConfig } from '@adsup/config';
import {
  ActionItemRepository,
  AttendanceRepository,
  AttendanceWorkerRepository,
  KpiEvidenceRepository,
  KpiGovernanceRepository,
  KpiRepository,
  KpiWorkerRepository,
  PenaltyRepository,
  BookingWorkerRepository,
  ExportRepository,
  createDatabaseClient,
} from '@adsup/database';
import pino from 'pino';
import { CloseDayService } from './kpi/close-day-service.js';
import { CloseDayRunner } from './kpi/close-day-runner.js';
import { EvidenceDebtRunner } from './kpi/evidence-debt-runner.js';
import { KpiScheduler } from './kpi/scheduler.js';
import { RerunRunner } from './kpi/rerun-runner.js';
import { OutboxDispatcher } from './outbox/outbox-dispatcher.js';
import { WorkerMetrics } from './observability.js';
import { createKpiRealtimeEffect } from './effects/realtime-effect.js';
import { createKpiNotificationEffect } from './effects/notification-effect.js';
import { AttendanceScheduler } from './attendance/scheduler.js';
import { AttendanceDayCloseRunner } from './attendance/day-close-runner.js';
import { MonthlyAbsenceRunner } from './attendance/monthly-absence-runner.js';
import { VideoConversionRunner } from './attendance/video-conversion-runner.js';
import { CheckInReminderRunner } from './attendance/check-in-reminder-runner.js';
import { MediaRetentionRunner } from './attendance/media-retention-runner.js';
import { BookingScheduler } from './bookings/scheduler.js';

const config = parseConfig(process.env);
const logger = pino({ level: config.logLevel, redact: ['*.token', '*.secret', '*.url'] });
const database = createDatabaseClient(config.databaseUrl);
const metrics = new WorkerMetrics();
const workerId = `worker-${process.pid}`;
const workerRepository = new KpiWorkerRepository(database);
const attendanceWorkerRepository = new AttendanceWorkerRepository(database);
const bookingWorkerRepository = new BookingWorkerRepository(database);
const exportRepository = new ExportRepository(database);
const attendancePenaltyRepository = new PenaltyRepository(database);
const attendanceActionItems = new ActionItemRepository(database);
const closeDayService = new CloseDayService(
  new KpiRepository(database),
  workerRepository,
  attendanceActionItems,
);
const closeDay = new CloseDayRunner(workerRepository, closeDayService);
const reruns = new RerunRunner(workerRepository, closeDayService);
const evidence = new EvidenceDebtRunner(new KpiEvidenceRepository(database));
const scheduler = new KpiScheduler(database, closeDay, evidence, reruns);
const attendanceScheduler = new AttendanceScheduler(
  attendanceWorkerRepository,
  new VideoConversionRunner(attendanceWorkerRepository, {
    async convert() {
      return {};
    },
  }),
  new AttendanceDayCloseRunner(
    new AttendanceRepository(database),
    attendancePenaltyRepository,
    attendanceActionItems,
  ),
  new MonthlyAbsenceRunner(attendanceWorkerRepository),
  new CheckInReminderRunner(attendanceWorkerRepository),
  new MediaRetentionRunner(attendanceWorkerRepository),
);
const bookingScheduler = new BookingScheduler();
void bookingWorkerRepository;
void exportRepository;
const realtime = await createKpiRealtimeEffect({
  mode: config.realtimeBackplane,
  redisUrl: config.redisUrl,
  metrics,
});
const notifications = createKpiNotificationEffect({
  driver: config.pushDriver,
  webhookUrl: config.pushWebhookUrl,
  webhookSecret: config.pushWebhookSecret,
  metrics,
});
const dispatcher = new OutboxDispatcher(
  new KpiGovernanceRepository(database),
  realtime.effect,
  notifications,
);
const port = config.port + 1;
const server = createServer(async (request, response) => {
  if (request.url === '/health/live') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"status":"ok"}');
    return;
  }
  if (request.url === '/health/ready') {
    try {
      await database.$queryRaw`SELECT 1`;
      response.writeHead(200);
      response.end('{"status":"ok"}');
    } catch {
      response.writeHead(503);
      response.end('{"status":"unavailable"}');
    }
    return;
  }
  if (request.url === '/internal/metrics') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(metrics.snapshot()));
    return;
  }
  response.writeHead(404);
  response.end();
});
server.listen(port, () => logger.info({ port }, 'adsup worker shell ready'));
let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    const scheduled = await scheduler.tick();
    for (const result of scheduled) {
      metrics.increment('kpi_close_runs_total');
      metrics.increment('kpi_close_memberships_total', result.processed);
      metrics.increment(
        'kpi_close_item_failures_total',
        'failures' in result ? result.failures : 0,
      );
    }
    const attendanceScheduled = await attendanceScheduler.tick();
    for (const result of attendanceScheduled) {
      metrics.increment('attendance_runs_total');
      metrics.increment('attendance_processed_total', result.processed);
    }
    const bookingScheduled = await bookingScheduler.tick();
    for (const result of bookingScheduled) {
      metrics.increment('booking_runs_total');
      metrics.increment('booking_processed_total', result.processed);
    }
    const result = await dispatcher.dispatch(workerId);
    metrics.increment('worker_ticks_total');
    metrics.increment('outbox_sent_total', result.sent);
    metrics.increment('outbox_failed_total', result.failed);
  } catch (error) {
    metrics.increment('worker_tick_failures_total');
    logger.error(
      { errorName: error instanceof Error ? error.name : 'UnknownError' },
      'worker tick failed',
    );
  } finally {
    running = false;
  }
}
const runManagedLoops = process.env.NODE_ENV !== 'test';
const interval = runManagedLoops ? setInterval(() => void tick(), 60_000) : undefined;
if (runManagedLoops) void tick();
async function shutdown() {
  if (interval) clearInterval(interval);
  server.close();
  await realtime.close();
  await database.$disconnect();
}
process.once('SIGINT', () => {
  void shutdown();
});
process.once('SIGTERM', () => {
  void shutdown();
});
