import { Switch } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/** On/off switch with a thumb that stays visible in both states and both themes. */
export function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
  disabled,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ true: colors.primary, false: colors.border }}
      thumbColor={value ? colors.onPrimary : colors.textMuted}
    />
  );
}
