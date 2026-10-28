import { render } from '@testing-library/react-native';

import { BarChart } from '@/components/charts/BarChart';
import { DonutChart, topSlices } from '@/components/charts/DonutChart';
import { ProgressBar } from '@/components/ProgressBar';
import type { Paise } from '@/db/types';
import { BudgetNumbers } from '@/features/budgets/BudgetsScreen';
import { budgetProgress } from '@/lib/budget';
import type { BudgetLine } from '@/services/budgetService';
import { ThemeProvider } from '@/theme/ThemeProvider';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

describe('topSlices', () => {
  const slice = (key: string, value: number) => ({ key, value, color: '#000' });

  test('keeps everything when within the limit', () => {
    expect(topSlices([slice('a', 3), slice('b', 1)], 5, '#999')).toHaveLength(2);
  });

  test('merges the rest into one Other slice', () => {
    const out = topSlices([slice('a', 5), slice('b', 4), slice('c', 2), slice('d', 1)], 2, '#999');
    expect(out.map((s) => s.key)).toEqual(['a', 'b', '__other']);
    expect(out[2]).toEqual({ key: '__other', value: 3, color: '#999' });
  });
});

test('donut exposes its label and centre text, and survives zero slices', async () => {
  const { getByLabelText, getByText } = await wrap(
    <DonutChart
      slices={[
        { key: 'food', value: 300, color: '#f00' },
        { key: '__other', value: 0, color: '#999' },
      ]}
      centerTop="Expense"
      centerBottom="₹3"
      accessibilityLabel="Expense by category: Food 100%"
    />,
  );
  expect(getByLabelText('Expense by category: Food 100%')).toBeTruthy();
  expect(getByText('Expense')).toBeTruthy();
  expect(getByText('₹3')).toBeTruthy();
});

test('bar chart shows only the labels it is asked to', async () => {
  const { getByLabelText, queryByText } = await wrap(
    <BarChart
      bars={[
        { key: '1', value: 10, label: '1', showLabel: true },
        { key: '2', value: 0, label: '2', showLabel: false },
        { key: '3', value: 5, label: '3', showLabel: true, current: true },
      ]}
      color="#00f"
      accessibilityLabel="Spending trend"
    />,
  );
  expect(getByLabelText('Spending trend')).toBeTruthy();
  expect(queryByText('1')).toBeTruthy();
  expect(queryByText('2')).toBeNull();
});

describe('ProgressBar', () => {
  test.each([
    [50, 'normal', 50],
    [85, 'warning', 85],
    [130, 'over', 100],
  ] as const)('%i%% (%s) reports now=%i', async (percent, state, now) => {
    const { getByRole } = await wrap(<ProgressBar percent={percent} state={state} />);
    expect(getByRole('progressbar').props.accessibilityValue).toEqual({ min: 0, max: 100, now });
  });
});

describe('BudgetNumbers', () => {
  const line = (spent: number, budget: number): BudgetLine => ({
    budget: {
      id: 'b1',
      categoryId: null,
      amountPaise: budget as Paise,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
    category: null,
    spentPaise: spent,
    progress: budgetProgress(spent, budget),
  });

  test('normal: spent of budget and amount left', async () => {
    const { getByText } = await wrap(<BudgetNumbers line={line(400000, 1000000)} />);
    expect(getByText('₹4,000 of ₹10,000 · ₹6,000 left')).toBeTruthy();
  });

  test('warning: also shows percent used', async () => {
    const { getByText } = await wrap(<BudgetNumbers line={line(820000, 1000000)} />);
    expect(getByText('₹8,200 of ₹10,000 · 82% used · ₹1,800 left')).toBeTruthy();
  });

  test('over: shows the amount over', async () => {
    const { getByText } = await wrap(<BudgetNumbers line={line(1120000, 1000000)} />);
    expect(getByText('₹11,200 of ₹10,000 · ₹1,200 over')).toBeTruthy();
  });
});
