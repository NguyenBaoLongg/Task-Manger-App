import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { configureNotificationCategories } from '@/notifications/notification-categories';
import { AppThemeProvider } from '@/theme/theme-provider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function RootLayout() {
  useEffect(() => {
    void configureNotificationCategories().catch(() => undefined);
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AppThemeProvider>
    </QueryClientProvider>
  );
}
