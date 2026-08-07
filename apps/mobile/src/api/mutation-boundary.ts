type MutationOptions = { keyFactory: (operation?: string) => string };

export const createMutationBoundary = ({ keyFactory }: MutationOptions) => {
  const keys = new Map<string, string>();
  const headers = (operation: string, expectedStateVersion?: number) => {
    const key = keys.get(operation) ?? keyFactory(operation);
    keys.set(operation, key);
    return {
      'Idempotency-Key': key,
      ...(expectedStateVersion === undefined ? {} : { 'If-Match': String(expectedStateVersion) }),
    };
  };
  return {
    headers,
    classifyError: (error: { code?: string }) =>
      error.code === 'STATE_VERSION_CONFLICT'
        ? { kind: 'conflict' as const, retryable: true }
        : error.code === 'AUTHORIZATION_DENIED'
          ? { kind: 'forbidden' as const, retryable: false }
          : { kind: 'unknown' as const, retryable: false },
  };
};
