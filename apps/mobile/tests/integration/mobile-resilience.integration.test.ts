import { classifyRecovery } from '@/api/recovery-policy';
import { createMediaLifecycle } from '@/media/app-lifecycle-upload';

describe('mobile resilience', () => {
  it('returns recoverable states for offline, conflict and session expiry', () => {
    expect(classifyRecovery({ code: 'NETWORK_ERROR' })).toEqual({
      kind: 'offline',
      retryable: true,
    });
    expect(classifyRecovery({ code: 'STATE_VERSION_CONFLICT' })).toEqual({
      kind: 'conflict',
      retryable: true,
    });
    expect(classifyRecovery({ code: 'AUTHENTICATION_REQUIRED' })).toEqual({
      kind: 'session-expired',
      retryable: false,
    });
    const lifecycle = createMediaLifecycle();
    lifecycle.pause();
    expect(lifecycle.state()).toBe('PAUSED');
    lifecycle.resume();
    expect(lifecycle.state()).toBe('UPLOADING');
  });
});
