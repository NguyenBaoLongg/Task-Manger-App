import { randomUUID } from 'node:crypto';
import type { KpiWorkerRepository } from '@adsup/database';
import type { CloseDayService } from './close-day-service.js';

interface RerunPayload {
  branchIds?: string[];
  membershipIds?: string[];
}

export class RerunRunner {
  constructor(
    private readonly repository: KpiWorkerRepository,
    private readonly service: CloseDayService,
    private readonly batchSize = 200,
  ) {}

  async runPending(tenantId: string, now = new Date(), workerId = randomUUID()) {
    const pending = await this.repository.listPendingRerunRuns(tenantId, now);
    const results = [];
    for (const run of pending) {
      const claim = await this.repository.claimRun({
        tenantId,
        id: run.id,
        workerId,
        now,
        leaseUntil: new Date(now.getTime() + 60_000),
      });
      if (!claim) continue;
      const payload = claim.payloadJson as RerunPayload;
      let checkpoint = claim.checkpoint ?? undefined;
      let processed = 0;
      let failures = 0;
      try {
        while (true) {
          const members = await this.repository.listCandidateMemberships(
            tenantId,
            checkpoint,
            this.batchSize,
            {
              membershipIds: payload.membershipIds?.length ? payload.membershipIds : undefined,
              branchIds: payload.branchIds?.length ? payload.branchIds : undefined,
              businessDate: run.businessDate,
            },
          );
          if (members.length === 0) break;
          for (const member of members) {
            try {
              const result = await this.service.closeMembership({
                tenantId,
                membershipId: member.id,
                businessDate: run.businessDate,
                jobRunId: run.id,
                now,
                correlationId: run.correlationId,
              });
              if ('blocked' in result && result.blocked && result.code === 'EVALUATION_NOT_DUE') {
                throw new Error('EVALUATION_NOT_DUE');
              }
            } catch {
              failures += 1;
            }
            checkpoint = member.id;
            processed += 1;
            await this.repository.advanceCheckpoint({
              tenantId,
              id: run.id,
              workerId,
              checkpoint,
              leaseUntil: new Date(Date.now() + 60_000),
            });
          }
          if (members.length < this.batchSize) break;
        }
        if (failures) {
          await this.repository.failRun({
            tenantId,
            id: run.id,
            workerId,
            code: 'RERUN_ITEM_FAILURES',
            partial: true,
          });
        } else {
          await this.repository.completeRun({
            tenantId,
            id: run.id,
            workerId,
            completedAt: now,
          });
        }
        results.push({ runId: run.id, processed, failures });
      } catch (error) {
        await this.repository.failRun({
          tenantId,
          id: run.id,
          workerId,
          code: 'RERUN_FAILED',
          partial: processed > 0,
        });
        throw error;
      }
    }
    return results;
  }
}
