import type { BookingStatus, BookingType } from '@adsup/domain';

export class BookingTestClock {
  constructor(private current: Date) {}

  now() {
    return new Date(this.current);
  }

  set(value: Date) {
    this.current = new Date(value);
  }
}

export class BookingChatCollector {
  readonly messages: Array<{ tenantId: string; channelId: string; dedupeKey: string; body: string }> =
    [];

  async send(input: { tenantId: string; channelId: string; dedupeKey: string; body: string }) {
    if (!this.messages.some((message) => message.dedupeKey === input.dedupeKey)) {
      this.messages.push(input);
    }
  }
}

export function bookingFixture(
  overrides: Partial<{
    type: BookingType;
    status: BookingStatus;
    startsAt: Date;
  }> = {},
) {
  return {
    type: overrides.type ?? ('SCHEDULED' as const),
    status: overrides.status ?? ('SCHEDULED' as const),
    startsAt: overrides.startsAt ?? new Date('2026-07-24T02:00:00.000Z'),
  };
}
