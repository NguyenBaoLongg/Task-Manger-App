import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import {
  createPaymentProofAction,
  listPenaltySettlements,
} from '@/features/attendance/penalty-ledger';
import {
  AppButton,
  ScreenFrame,
  SectionHeading,
  StatusPill,
  Surface,
} from '@/components/ui/ScreenPrimitives';
import { tokens } from '@/theme/tokens';

type Settlement = { id: string; amountMinor?: number; status?: string; reason?: string };

const formatAmount = (amountMinor = 0) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amountMinor);

export default function PenaltiesScreen() {
  const context = useTenantContextStore((state) => state.context);
  const [items, setItems] = useState<Settlement[]>([]);
  const [proofMediaId, setProofMediaId] = useState('');
  const [status, setStatus] = useState<string>();

  useEffect(() => {
    if (!context) return;
    let active = true;
    void getAuthenticatedClient()
      .then((client) =>
        listPenaltySettlements(client, context.tenantId, new Date().toISOString().slice(0, 7)),
      )
      .then((page) => {
        const value = page as { items?: Settlement[] };
        if (active) setItems(value.items ?? []);
      })
      .catch(() => {
        if (active) setStatus('Không thể tải sổ phạt lúc này.');
      });
    return () => {
      active = false;
    };
  }, [context]);

  const submitProof = async (settlementId: string) => {
    if (!context || !proofMediaId.trim()) {
      setStatus('Cần chọn media chứng từ thanh toán đã được cấp quyền.');
      return;
    }
    try {
      const client = await getAuthenticatedClient();
      await createPaymentProofAction(
        client,
        context.tenantId,
        settlementId,
        context.permissions,
      ).submit(proofMediaId.trim());
      setStatus('Đã gửi chứng từ thanh toán để quản lý duyệt.');
    } catch {
      setStatus('Chứng từ chưa được chấp nhận. Vui lòng kiểm tra quyền media.');
    }
  };

  return (
    <ScreenFrame
      eyebrow="ADSUP / ATTENDANCE"
      title="Sổ phạt"
      subtitle="Theo dõi lỗi, số tiền và gửi chứng từ thanh toán cho từng khoản."
    >
      <Surface style={styles.proofCard}>
        <SectionHeading title="Chứng từ thanh toán" detail="Media đã được cấp quyền" />
        <TextInput
          accessibilityLabel="Payment proof media id"
          value={proofMediaId}
          onChangeText={setProofMediaId}
          placeholder="Nhập media id chứng từ"
          placeholderTextColor={tokens.color.muted}
          style={styles.input}
        />
      </Surface>

      <View style={styles.section}>
        <SectionHeading title="Tháng hiện tại" detail={`${items.length} khoản`} />
        {items.length === 0 ? (
          <Surface style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Không có khoản phạt trong tháng này</Text>
            <Text style={styles.body}>
              Các khoản đi muộn, nghỉ sai quy định hoặc chứng từ sẽ hiện tại đây.
            </Text>
          </Surface>
        ) : (
          items.map((item) => (
            <Surface key={item.id} style={styles.penaltyCard}>
              <View style={styles.cardTopline}>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{item.reason ?? 'Khoản phạt'}</Text>
                  <Text style={styles.amount}>{formatAmount(item.amountMinor)}</Text>
                </View>
                <StatusPill label={item.status ?? 'PENDING'} tone="warning" />
              </View>
              <AppButton
                label="Gửi chứng từ"
                variant="secondary"
                onPress={() => void submitProof(item.id)}
                disabled={!proofMediaId.trim()}
              />
            </Surface>
          ))
        )}
      </View>

      {status ? (
        <Text accessibilityRole="alert" style={styles.status}>
          {status}
        </Text>
      ) : null}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  proofCard: { gap: tokens.spacing.md },
  section: { gap: tokens.spacing.md },
  input: {
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
    color: tokens.color.ink,
    fontSize: tokens.typography.body,
  },
  emptyCard: { gap: tokens.spacing.xs, backgroundColor: tokens.color.primarySoft },
  emptyTitle: { color: tokens.color.ink, fontSize: tokens.typography.body, fontWeight: '800' },
  body: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
  penaltyCard: { gap: tokens.spacing.lg },
  cardTopline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: tokens.spacing.md,
    alignItems: 'flex-start',
  },
  cardCopy: { flex: 1, gap: 5 },
  cardTitle: { color: tokens.color.ink, fontSize: tokens.typography.body, fontWeight: '800' },
  amount: { color: tokens.color.primary, fontSize: tokens.typography.heading, fontWeight: '900' },
  status: { color: tokens.color.info, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
});
