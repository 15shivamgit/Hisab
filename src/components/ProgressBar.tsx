// Budget progress bar (BUDGETS.md § Progress states). Colour is never the only signal:
// callers always show the numbers ("₹8,200 of ₹10,000") next to it.

import { View } from 'react-native';

import type { BudgetState } from '@/lib/budget';
import { useTheme } from '@/theme/ThemeProvider';

export function ProgressBar({ percent, state }: { percent: number; state: BudgetState }) {
  const { colors, radius } = useTheme();
  const fill =
    state === 'over' ? colors.danger : state === 'warning' ? colors.warning : colors.primary;
  const width = state === 'over' ? 100 : Math.min(100, Math.max(0, percent));
  return (
    <View
      style={{
        height: 8,
        borderRadius: radius.full,
        backgroundColor: colors.surfaceAlt,
        overflow: 'hidden',
      }}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.min(percent, 100) }}
    >
      <View
        style={{
          width: `${width}%`,
          height: '100%',
          backgroundColor: fill,
          borderRadius: radius.full,
        }}
      />
    </View>
  );
}
