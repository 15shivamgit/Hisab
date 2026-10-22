import { View, type DimensionValue } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/** Grey placeholder block shaped like the content that is loading. */
export function Skeleton({
  width = '100%',
  height = 16,
}: {
  width?: DimensionValue;
  height?: number;
}) {
  const { colors, radius } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt }}
    />
  );
}
