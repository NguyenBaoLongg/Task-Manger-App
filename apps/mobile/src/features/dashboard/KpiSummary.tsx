import { StyleSheet, Text, View } from 'react-native';
import type { KpiProgress } from './kpi-queries';
import { StatusPill, Surface } from '@/components/ui/ScreenPrimitives';
import { tokens } from '@/theme/tokens';

const formatExactValue = (metric: { value: string; unit: string }) => {
  const [integer = '0', fraction] = metric.value.split('.');
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const formattedValue = fraction ? `${groupedInteger},${fraction}` : groupedInteger;
  return `${formattedValue} ${metric.unit}`;
};

export const KpiSummary = ({ progress }: { progress: KpiProgress }) => (
  <View accessibilityLabel="KPI hôm nay" style={styles.container}>
    <View style={styles.heading}>
      <Text style={styles.title}>KPI hôm nay</Text>
      <StatusPill label={progress.businessDate} tone="info" />
    </View>
    <View style={styles.grid}>
      {progress.items.slice(0, 4).map((item) => (
        <Surface key={item.kpiDefinitionId} style={styles.tile}>
          <Text style={styles.state}>{item.name}</Text>
          <Text style={styles.value}>
            {item.actual ? formatExactValue(item.actual) : `-- ${item.target.unit}`}
          </Text>
          <Text style={styles.target}>Mục tiêu {formatExactValue(item.target)}</Text>
        </Surface>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { gap: tokens.spacing.md },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: tokens.color.ink, fontSize: tokens.typography.heading, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.md },
  tile: {
    width: '47%',
    minHeight: 108,
    gap: 7,
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.primaryMuted,
  },
  state: { color: tokens.color.muted, fontSize: tokens.typography.label, fontWeight: '700' },
  value: { color: tokens.color.primary, fontSize: 23, lineHeight: 29, fontWeight: '800' },
  target: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall },
});
