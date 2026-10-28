// Trend bars (REPORTS_AND_EXPORT.md § Trend). Plain Views: one bar per day or week. Bars are
// decorative for screen readers; the chart gets one summary label.

import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

export interface Bar {
  key: string;
  value: number;
  /** Shown under the bar when `showLabel` is set. */
  label: string;
  showLabel: boolean;
  /** Highlighted (e.g. today). */
  current?: boolean;
}

export function BarChart({
  bars,
  height = 120,
  color,
  accessibilityLabel,
}: {
  bars: readonly Bar[];
  height?: number;
  color: string;
  accessibilityLabel: string;
}) {
  const { colors, spacing, radius } = useTheme();
  const max = Math.max(1, ...bars.map((b) => b.value));
  const gap = bars.length > 20 ? 2 : 4;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ gap: spacing.xs }}
    >
      <View style={[styles.row, { height, gap, borderBottomColor: colors.border }]}>
        {bars.map((b) => (
          <View key={b.key} style={styles.slot}>
            <View
              style={{
                height: b.value > 0 ? Math.max(2, (b.value / max) * height) : 0,
                backgroundColor: b.current ? color : `${color}B3`,
                borderTopLeftRadius: radius.sm,
                borderTopRightRadius: radius.sm,
              }}
            />
          </View>
        ))}
      </View>
      <View style={[styles.labels, { gap }]}>
        {bars.map((b) => (
          <View key={b.key} style={styles.slot}>
            {b.showLabel ? (
              <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.label}>
                {b.label}
              </AppText>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  labels: { flexDirection: 'row' },
  slot: { flex: 1, justifyContent: 'flex-end', minWidth: 0 },
  // Labels may be wider than their bar; let them overflow to the right, unclipped.
  label: { width: 40, textAlign: 'left' },
});
