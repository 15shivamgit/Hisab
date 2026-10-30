// Category donut (REPORTS_AND_EXPORT.md § Category breakdown, DASHBOARD.md § 7). Drawn with
// react-native-svg arcs (stroke-dasharray on circles); the list beside it carries the
// numbers, so the chart is never the only source of information.

import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

export interface DonutSlice {
  key: string;
  value: number;
  color: string;
}

/** Top `max` slices; the rest are merged into one grey "Other" slice. */
export function topSlices(
  slices: readonly DonutSlice[],
  max: number,
  otherColor: string,
): DonutSlice[] {
  if (slices.length <= max) return [...slices];
  const rest = slices.slice(max).reduce((sum, s) => sum + s.value, 0);
  return [...slices.slice(0, max), { key: '__other', value: rest, color: otherColor }];
}

export function DonutChart({
  slices,
  size = 160,
  thickness = 22,
  centerTop,
  centerBottom,
  accessibilityLabel,
}: {
  slices: readonly DonutSlice[];
  size?: number;
  thickness?: number;
  centerTop?: string;
  centerBottom?: string;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const visible = slices.filter((s) => s.value > 0);
  const total = visible.reduce((sum, s) => sum + s.value, 0);
  // A small gap between slices so neighbours with similar colours stay apart.
  const gap = visible.length > 1 ? 2 : 0;

  const arcs: { key: string; color: string; dash: number; offset: number }[] = [];
  let start = 0;
  for (const s of visible) {
    const length = total > 0 ? (s.value / total) * circumference : 0;
    arcs.push({ key: s.key, color: s.color, dash: Math.max(length - gap, 0.5), offset: -start });
    start += length;
  }

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.surfaceAlt}
            strokeWidth={thickness}
            fill="none"
          />
          {arcs.map((a) => (
            <Circle
              key={a.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={a.color}
              strokeWidth={thickness}
              strokeDasharray={`${a.dash} ${circumference}`}
              strokeDashoffset={a.offset}
              fill="none"
            />
          ))}
        </G>
      </Svg>
      {centerTop ? (
        <AppText
          variant="caption"
          color="textMuted"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ maxWidth: size - thickness * 2 - 8 }}
        >
          {centerTop}
        </AppText>
      ) : null}
      {centerBottom ? (
        <AppText
          variant="bodyStrong"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ maxWidth: size - thickness * 2 - 8 }}
        >
          {centerBottom}
        </AppText>
      ) : null}
    </View>
  );
}
