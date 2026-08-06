export const classifyRecovery = (error: { code?: string }) => {
  if (error.code === 'AUTHENTICATION_REQUIRED')
    return { kind: 'session-expired' as const, retryable: false };
  if (error.code === 'STATE_VERSION_CONFLICT')
    return { kind: 'conflict' as const, retryable: true };
  if (error.code === 'NETWORK_ERROR') return { kind: 'offline' as const, retryable: true };
  if (error.code === 'API_ERROR' || error.code === 'HTTP_ERROR')
    return { kind: 'error' as const, retryable: true };
  return { kind: 'error' as const, retryable: false };
};
