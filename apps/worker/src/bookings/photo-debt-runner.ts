import type { BookingWorkerRepository } from '@adsup/database';

export interface MediaReadyOutboxEvent {
  id: string;
  tenantId: string;
  eventType: string;
  correlationId?: string;
  payloadRedacted: unknown;
}

export class PhotoDebtRunner {
  constructor(private readonly repository: BookingWorkerRepository) {}

  async handle(event: MediaReadyOutboxEvent) {
    if (event.eventType !== 'media.ready.v1') return { changed: false as const };
    const payload =
      event.payloadRedacted && typeof event.payloadRedacted === 'object'
        ? (event.payloadRedacted as Record<string, unknown>)
        : {};
    if (
      payload.purpose !== 'CUSTOMER_BOOKING_PHOTO' ||
      payload.sourceType !== 'BOOKING' ||
      typeof payload.mediaId !== 'string'
    ) {
      return { changed: false as const };
    }
    return this.repository.resolveCustomerPhotoDebt({
      tenantId: event.tenantId,
      mediaId: payload.mediaId,
      sourceEventId: event.id,
      correlationId: event.correlationId ?? event.id,
    });
  }
}
