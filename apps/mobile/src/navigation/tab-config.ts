export const tabConfig = [
  {
    name: 'dashboard',
    label: 'Tổng quan',
    icon: 'grid-outline',
    activeIcon: 'grid',
    testID: 'tab.dashboard',
  },
  {
    name: 'workspace',
    label: 'Công việc',
    icon: 'briefcase-outline',
    activeIcon: 'briefcase',
    testID: 'tab.workspace',
  },
  {
    name: 'chat',
    label: 'Tin nhắn',
    icon: 'chatbubble-ellipses-outline',
    activeIcon: 'chatbubble-ellipses',
    testID: 'tab.chat',
  },
] as const;
