import { createMutationBoundary } from '@/api/mutation-boundary';

describe('mutation boundary', () => {
  it('reuses one idempotency key for retries and carries optimistic concurrency', () => {
    const boundary = createMutationBoundary({ keyFactory: () => 'idem-fixed' });
    expect(boundary.headers('booking.create', 7)).toEqual({
      'Idempotency-Key': 'idem-fixed',
      'If-Match': '7',
    });
    expect(boundary.headers('booking.create', 7)).toEqual(boundary.headers('booking.create', 7));
  });

  it('classifies stale state as a refreshable conflict', () => {
    const boundary = createMutationBoundary({ keyFactory: () => 'idem-1' });
    expect(boundary.classifyError({ code: 'STATE_VERSION_CONFLICT' })).toEqual({
      kind: 'conflict',
      retryable: true,
    });
    expect(boundary.classifyError({ code: 'AUTHORIZATION_DENIED' })).toEqual({
      kind: 'forbidden',
      retryable: false,
    });
  });
});
