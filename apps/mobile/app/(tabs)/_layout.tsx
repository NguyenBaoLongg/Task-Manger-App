import { useEffect, useState } from 'react';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import { tabConfig } from '@/navigation/tab-config';
import { tokens } from '@/theme/tokens';

export default function TabsLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void getAuthenticatedClient()
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) router.replace('/(auth)/sign-in');
      });
    return () => {
      active = false;
    };
  }, []);

  if (!ready) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.color.primary,
        tabBarInactiveTintColor: tokens.color.muted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginBottom: 5 },
        tabBarItemStyle: { paddingTop: 5 },
        tabBarStyle: {
          height: 72,
          borderTopColor: tokens.color.border,
          backgroundColor: tokens.color.surface,
        },
      }}
    >
      {tabConfig.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarButtonTestID: tab.testID,
            tabBarAccessibilityLabel: tab.label,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons
                name={focused ? tab.activeIcon : tab.icon}
                color={color}
                size={size ?? 22}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
