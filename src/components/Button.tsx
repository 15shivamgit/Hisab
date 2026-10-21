import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { minTouchTarget, type ColorTokens } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Shows a spinner and blocks presses (no double-submit, TRANSACTIONS.md). */
  loading?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

interface VariantColors {
  background: keyof ColorTokens | 'transparent';
  text: keyof ColorTokens;
  border?: keyof ColorTokens;
}

const variantColors: Record<ButtonVariant, VariantColors> = {
  primary: { background: 'primary', text: 'onPrimary' },
  secondary: { background: 'surface', text: 'primary', border: 'border' },
  ghost: { background: 'transparent', text: 'primary' },
  danger: { background: 'danger', text: 'onDanger' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const v = variantColors[variant];
  const inactive = disabled || loading;
  const textColor = colors[v.text];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      android_ripple={{ color: colors.border }}
      testID={testID}
      style={[
        styles.base,
        {
          backgroundColor: v.background === 'transparent' ? 'transparent' : colors[v.background],
          borderColor: v.border ? colors[v.border] : 'transparent',
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <AppText variant="bodyStrong" style={{ color: textColor }}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
});
