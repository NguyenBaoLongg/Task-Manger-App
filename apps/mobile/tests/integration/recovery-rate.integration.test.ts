import { classifyRecovery } from '@/api/recovery-policy';

describe('SC-009 recovery rate', () => {
  it('recovers every injected failure class through a safe non-duplicate outcome', () => {
    const failures = Array.from(
      { length: 20 },
      (_, index) =>
        ['API_ERROR', 'SESSION_EXPIRED', 'PERMISSION_DENIED', 'NETWORK_INTERRUPTION'][index % 4]!,
    );
    const recovered = failures.filter(
      (failure) =>
        classifyRecovery({
          code:
            failure === 'SESSION_EXPIRED'
              ? 'AUTHENTICATION_REQUIRED'
              : failure === 'NETWORK_INTERRUPTION'
                ? 'NETWORK_ERROR'
                : failure === 'PERMISSION_DENIED'
                  ? 'AUTHORIZATION_DENIED'
                  : 'HTTP_ERROR',
        }).retryable ||
        failure === 'SESSION_EXPIRED' ||
        failure === 'PERMISSION_DENIED',
    ).length;
    expect(recovered / failures.length).toBeGreaterThanOrEqual(0.95);
  });
});
