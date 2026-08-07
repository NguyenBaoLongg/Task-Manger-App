import { render } from '@testing-library/react-native';
import { KpiSummary } from '@/features/dashboard/KpiSummary';
import type { KpiProgress } from '@/features/dashboard/kpi-queries';

describe('KpiSummary', () => {
  it('renders exact KPI values with their units instead of rendering metric objects', () => {
    const progress: KpiProgress = {
      businessDate: '2026-07-27',
      reportStatus: 'OPEN',
      openedAt: '2026-07-27T00:00:00.000Z',
      closedAt: '2026-07-27T23:59:59.999Z',
      items: [
        {
          kpiDefinitionId: 'kpi-revenue',
          name: 'Doanh thu',
          target: { value: '10000000', unit: 'VND' },
          actual: { value: '7500000', unit: 'VND' },
          remaining: { value: '2500000', unit: 'VND' },
          passed: false,
          required: true,
          sourceStatus: 'FRESH',
          sourceObservedAt: '2026-07-27T10:00:00.000Z',
          deadlineAt: '2026-07-27T17:00:00.000Z',
          deepLink: '/kpi/kpi-revenue',
        },
      ],
    };

    const screen = render(<KpiSummary progress={progress} />);

    expect(screen.getByText('Doanh thu')).toBeTruthy();
    expect(screen.getByText('7.500.000 VND')).toBeTruthy();
    expect(screen.getByText('Mục tiêu 10.000.000 VND')).toBeTruthy();
  });
});
