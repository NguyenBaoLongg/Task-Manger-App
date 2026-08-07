import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/theme/tokens';

export const LoadingState = ({ label = 'Loading' }: { label?: string }) => (
  <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.container}>
    <View style={styles.stateCard}>
      <ActivityIndicator color={tokens.color.primary} />
      <Text style={styles.title}>{label}</Text>
    </View>
  </View>
);
export const EmptyState = ({ label }: { label: string }) => (
  <View style={styles.stateCard}>
    <Text style={styles.title}>{label}</Text>
    <Text style={styles.body}>Dữ liệu sẽ hiển thị tại đây khi có bản ghi phù hợp.</Text>
  </View>
);
export const ErrorState = ({
  label = 'Không thể tải dữ liệu',
  onRetry,
}: {
  label?: string;
  onRetry?: () => void;
}) => (
  <View style={styles.container}>
    <View style={styles.stateCard}>
      <Text style={styles.title}>{label}</Text>
      <Text style={styles.body}>Hãy kiểm tra kết nối hoặc tải lại dữ liệu.</Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}>
          <Text style={styles.buttonText}>Thử lại</Text>
        </Pressable>
      ) : null}
    </View>
  </View>
);
export const ForbiddenState = () => (
  <View style={styles.container}>
    <View style={styles.stateCard}>
      <Text style={styles.title}>Bạn chưa có quyền truy cập</Text>
      <Text style={styles.body}>
        Vui lòng chọn đúng workspace hoặc liên hệ quản lý để được cấp quyền.
      </Text>
    </View>
  </View>
);
export const ConflictState = () => (
  <View style={styles.container}>
    <View style={styles.stateCard}>
      <Text style={styles.title}>Dữ liệu đã thay đổi</Text>
      <Text style={styles.body}>Tải lại màn hình rồi thực hiện thao tác một lần nữa.</Text>
    </View>
  </View>
);
export const OfflineState = () => (
  <View style={styles.container}>
    <View style={styles.stateCard}>
      <Text style={styles.title}>Đang ngoại tuyến</Text>
      <Text style={styles.body}>Một số thao tác sẽ tiếp tục khi thiết bị có mạng trở lại.</Text>
    </View>
  </View>
);
export const SessionExpiredState = () => (
  <View style={styles.container}>
    <View style={styles.stateCard}>
      <Text style={styles.title}>Phiên đăng nhập đã hết hạn</Text>
      <Text style={styles.body}>Đăng nhập lại để tiếp tục làm việc trong ADSUP.</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.canvas,
    justifyContent: 'center',
    padding: tokens.spacing.xl,
  },
  stateCard: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.xl,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
  },
  title: {
    color: tokens.color.ink,
    fontSize: tokens.typography.heading,
    fontWeight: '800',
    lineHeight: 26,
  },
  body: { color: tokens.color.muted, fontSize: tokens.typography.body, lineHeight: 23 },
  button: {
    minHeight: tokens.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.primary,
  },
  buttonText: {
    color: tokens.color.inkInverted,
    fontSize: tokens.typography.body,
    fontWeight: '800',
  },
});
