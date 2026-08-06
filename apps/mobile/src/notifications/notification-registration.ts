import * as Notifications from 'expo-notifications';
import type { createApiClient } from '@/api/api-client';
type ApiClient = ReturnType<typeof createApiClient>;
export const registerNotificationEndpoint = async (client: ApiClient) => {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('NOTIFICATION_PERMISSION_DENIED');
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  return client.request('/v1/notification-endpoints', {
    method: 'POST',
    body: { platform: 'EXPO', provider: 'EXPO', token },
    idempotencyKey: `notification-endpoint-${token}`,
  });
};
export const revokeNotificationEndpoint = (client: ApiClient, endpointId: string) =>
  client.request(`/v1/notification-endpoints/${encodeURIComponent(endpointId)}/revoke`, {
    method: 'POST',
    idempotencyKey: `notification-revoke-${endpointId}`,
  });
