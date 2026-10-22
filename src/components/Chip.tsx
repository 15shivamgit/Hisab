import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { minTouchTarget } from '@/theme/tokens';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: ReactNode;
  /** Single-select groups use radio semantics; multi-select use checkbox. */
  role?: 'radio' | 'checkbox' | 'button';
  accessibilityLabel?: string;
  testID?: string;
}

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  role = 'radio',
  accessibilityLabel,
  testID,
}: ChipProps) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={role === 'button' ? undefined : { checked: selected, selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      hitSlop={4}
      style={[
        styles.chip,
        {
          minHeight: minTouchTarget - 8,
          borderRadius: radius.full,
          paddingHorizontal: spacing.md,
          gap: spacing.xs,
          backgroundColor: selected ? colors.primarySoft : colors.surfaceAlt,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      {icon}
      <AppText variant="label" style={{ color: selected ? colors.primary : colors.text }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
});
