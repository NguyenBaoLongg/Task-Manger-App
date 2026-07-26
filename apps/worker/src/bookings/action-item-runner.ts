import { randomUUID } from 'node:crypto';
import type { BookingWorkerRepository } from '@adsup/database';
import type { BookingScheduledRunner } from './scheduler.js';

export class BookingActionItemRunner implements BookingScheduledRunner {
  constructor(
    private readonly repository: BookingWorkerRepository,
    private readonly maxAttempts = 3,
  ) {}

  async run(now: Date) {
    let processed = 0;
    const tenants = await this.repository.listTenantIds();
    for (const tenantId of tenants) {
      let lastError: unknown;
      for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
        try {
          const result = await this.repository.reconcileBookingActionItems({
            tenantId,
            now,
            sourceEventId: randomUUID(),
            correlationId: `booking-action-items:${tenantId}:${now.toISOString().slice(0, 10)}`,
          });
          processed += result.processed;
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (lastError) {
        throw lastError instanceof Error
          ? lastError
          : new Error('BOOKING_ACTION_ITEM_RECONCILIATION_FAILED');
      }
    }
    return [{ jobType: 'BOOKING_ACTION_ITEMS', processed }];
  }
}
