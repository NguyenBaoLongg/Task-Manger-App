import { createHash, randomUUID } from 'node:crypto';
import {
  aggregateBookingReport,
  getBookingReportWindow,
  renderBookingReport,
  type BookingReportType,
} from '@adsup/domain';
import type { BookingWorkerRepository } from '@adsup/database';
import type { BookingReportDeliveryPort } from './report-delivery.js';

export class BookingReportRunner {
  private readonly leaseOwner = `booking-report:${randomUUID()}`;
  constructor(
    private readonly repository: BookingWorkerRepository,
    private readonly delivery: BookingReportDeliveryPort,
    private readonly leaseDurationMs = 60_000,
  ) {}

  async run(input: {
    tenantId: string;
    reportType: BookingReportType;
    now: Date;
    branchIds?: string[];
    rerun?: boolean;
  }) {
    const timezone =
      (await this.repository.getTenantTimezone(input.tenantId)) ?? 'Asia/Ho_Chi_Minh';
    const window = getBookingReportWindow(input.reportType, input.now, timezone);
    const destinations = await this.repository.listBookingReportDestinations({
      tenantId: input.tenantId,
      reportType: input.reportType,
      effectiveAt: input.now,
    });
    const scope = input.branchIds ?? [
      ...new Set(
        destinations.flatMap((destination) => (destination.branchId ? [destination.branchId] : [])),
      ),
    ];
    const branchIds =
      scope.length > 0 ? scope : await this.repository.listActiveBranchIds(input.tenantId);
    const run = await this.repository.ensureReportRun({
      tenantId: input.tenantId,
      reportType: input.reportType,
      businessDate: new Date(`${window.businessDate}T00:00:00.000Z`),
      branchIds,
      correlationId: `${input.reportType}:${input.tenantId}:${window.businessDate}`,
      revision: input.rerun ? Date.now() : 1,
    });
    const claim = await this.repository.claimReportRun({
      tenantId: input.tenantId,
      runId: run.id,
      leaseOwner: this.leaseOwner,
      now: input.now,
      leaseDurationMs: this.leaseDurationMs,
    });
    if (!claim) return { runId: run.id, claimed: false, processed: 0 };
    const heartbeat = setInterval(
      () => {
        void this.repository.heartbeatReportRun({
          tenantId: input.tenantId,
          runId: run.id,
          leaseOwner: this.leaseOwner,
          now: new Date(),
          leaseDurationMs: this.leaseDurationMs,
        });
      },
      Math.max(1_000, Math.floor(this.leaseDurationMs / 2)),
    );
    heartbeat.unref();
    try {
      const rows = await this.repository.listBookingReportRows({
        tenantId: input.tenantId,
        branchIds: branchIds.length ? branchIds : undefined,
        startAt: window.startAt,
        endAt: window.endAt,
      });
      let processed = 0;
      const renderedHashes: string[] = [];
      for (const destination of destinations) {
        const destinationRows = destination.branchId
          ? rows.filter((row) => row.branchId === destination.branchId)
          : rows;
        const snapshot = aggregateBookingReport({
          reportType: input.reportType,
          businessDate: window.businessDate,
          branchIds: destination.branchId ? [destination.branchId] : undefined,
          bookings: destinationRows,
        });
        const body = renderBookingReport(snapshot);
        const contentHash = createHash('sha256').update(body).digest('hex');
        renderedHashes.push(`${destination.id}:${contentHash}`);
        const dedupeKey = `booking-report:${run.id}:${destination.id}`;
        const delivery = await this.repository.upsertReportDelivery({
          tenantId: input.tenantId,
          runId: run.id,
          branchId: destination.branchId ?? undefined,
          destinationChannelId: destination.chatChannelId,
          revision: input.rerun ? 2 : 1,
          dedupeKey,
          contentHash,
        });
        if (delivery.state === 'SUCCEEDED') continue;
        try {
          const sent = await this.delivery.send({
            tenantId: input.tenantId,
            channelId: destination.chatChannelId,
            dedupeKey,
            body,
          });
          await this.repository.markReportDeliverySent({
            tenantId: input.tenantId,
            deliveryId: delivery.id,
            messageId: sent.messageId,
          });
          processed += 1;
        } catch (error) {
          await this.repository.markReportDeliveryFailed({
            tenantId: input.tenantId,
            deliveryId: delivery.id,
            code: 'REPORT_DELIVERY_FAILED',
          });
          throw error;
        }
      }
      const reportContentHash = createHash('sha256')
        .update(renderedHashes.sort().join('|'))
        .digest('hex');
      await this.repository.completeReportRun({
        tenantId: input.tenantId,
        runId: run.id,
        leaseOwner: this.leaseOwner,
        now: new Date(),
        checkpoint: `destinations:${destinations.length}`,
        contentHash: reportContentHash,
        destinationCount: destinations.length,
      });
      return { runId: run.id, claimed: true, processed };
    } catch (error) {
      await this.repository.failReportRun({
        tenantId: input.tenantId,
        runId: run.id,
        leaseOwner: this.leaseOwner,
        code: 'BOOKING_REPORT_FAILED',
      });
      throw error;
    } finally {
      clearInterval(heartbeat);
    }
  }
}
