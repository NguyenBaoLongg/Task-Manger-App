import { Text, View } from 'react-native';
import type { ActionItemPage } from './action-item-feed';

export const ManagedActionItems = ({ page }: { page: ActionItemPage }) => (
  <View accessibilityLabel="Việc cần hoàn thành của quản lý">
    <Text>{page.openCount} việc đang mở</Text>
    {page.items.map((item) => (
      <Text key={item.id}>{item.title ?? item.itemType ?? item.id}</Text>
    ))}
  </View>
);
