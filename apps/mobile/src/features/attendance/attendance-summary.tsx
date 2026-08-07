import { Text, View } from 'react-native';
import { StatusPill } from '@/components/ui/ScreenPrimitives';

export const AttendanceSummary = ({
  status,
  lateMinutes,
}: {
  status: string;
  lateMinutes: number;
}) => (
  <View style={{ gap: 8 }}>
    <StatusPill label={status} tone={status === 'PRESENT' ? 'success' : 'warning'} />
    <Text>Đi muộn: {lateMinutes} phút</Text>
  </View>
);
