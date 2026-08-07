import type { createApiClient } from '@/api/api-client';

type ApiClient = ReturnType<typeof createApiClient>;

export const validateProfileName = (fullName: string) => {
  const value = fullName.trim();
  if (value.length < 2) throw new Error('PROFILE_NAME_REQUIRED');
  return value;
};

export const confirmProfile = (client: ApiClient, fullName: string, idempotencyKey: string) =>
  client.request('/v1/me', {
    method: 'PATCH',
    body: { fullName: validateProfileName(fullName) },
    idempotencyKey,
  });
