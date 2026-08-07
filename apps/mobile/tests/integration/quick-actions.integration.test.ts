import { createQuickActionFlow } from '@/notifications/arrived-proof-action';
import { createCancelRescheduleFlow } from '@/notifications/cancel-reschedule-action';

describe('quick actions', () => {
  it('requires consent and proof for ARRIVED and current reason/state for cancellation', async () => {
    const calls: string[] = [];
    const arrived = createQuickActionFlow({
      resolve: async () => true,
      submit: async () => {
        calls.push('arrived');
      },
    });
    await arrived.run();
    const cancel = createCancelRescheduleFlow({
      resolve: async () => true,
      submit: async () => {
        calls.push('cancel');
      },
    });
    await cancel.run();
    expect(calls).toEqual(['arrived', 'cancel']);
  });
});
