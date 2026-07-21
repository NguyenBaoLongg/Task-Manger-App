import { randomUUID } from 'node:crypto';
import type { KpiWorkerRepository } from '@adsup/database';
import type { CloseDayService } from './close-day-service.js';

export class CloseDayRunner {
  constructor(
    private readonly repository: KpiWorkerRepository,
    private readonly service: CloseDayService,
    private readonly batchSize = 200,
  ) {}

  async run(input: {
    tenantId: string;
    businessDate: Date;
    now?: Date;
    workerId?: string;
    correlationId?: string;
  }) {
    const now = input.now ?? new Date();
    const workerId = input.workerId ?? randomUUID();
    const correlationId = input.correlationId ?? randomUUID();
    const run = await this.repository.ensureRun({
      tenantId: input.tenantId,
      jobType: 'DAILY_KPI_CLOSE',
      businessDate: input.businessDate,
      correlationId,
    });
    const claim = await this.repository.claimRun({
      tenantId: input.tenantId,
      id: run.id,
      workerId,
      now,
      leaseUntil: new Date(now.getTime() + 60_000),
    });
    if (!claim) return { runId: run.id, claimed: false, processed: 0 };
    let checkpoint = claim.checkpoint ?? undefined;
    let processed = 0;
    let failures = 0;
    try {
      while (true) {
        const members = await this.repository.listCandidateMemberships(
          input.tenantId,
          checkpoint,
          this.batchSize,
        );
        if (members.length === 0) break;
        for (const member of members) {
          try {
            await this.service.closeMembership({
              tenantId: input.tenantId,
              membershipId: member.id,
              businessDate: input.businessDate,
              jobRunId: run.id,
              now,
              correlationId,
            });
          } catch {
            failures += 1;
          }
          checkpoint = member.id;
          processed += 1;
          await this.repository.advanceCheckpoint({
            tenantId: input.tenantId,
            id: run.id,
            workerId,
            checkpoint,
            leaseUntil: new Date(Date.now() + 60_000),
          });
        }
        if (members.length < this.batchSize) break;
      }
      if (failures > 0) {
        await this.repository.failRun({
          tenantId: input.tenantId,
          id: run.id,
          workerId,
          code: 'ITEM_FAILURES',
          partial: true,
        });
      } else {
        await this.repository.completeRun({
          tenantId: input.tenantId,
          id: run.id,
          workerId,
          completedAt: now,
        });
      }
      return { runId: run.id, claimed: true, processed, failures };
    } catch (error) {
      await this.repository.failRun({
        tenantId: input.tenantId,
        id: run.id,
        workerId,
        code: 'RUN_FAILED',
        partial: processed > 0,
      });
      throw error;
    }
  }
}
