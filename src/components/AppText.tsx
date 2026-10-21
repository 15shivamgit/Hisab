import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { ColorTokens, TypographyVariant } from '@/theme/tokens';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: keyof ColorTokens;
  /** Monospaced digits so amounts line up (DESIGN_TOKENS.md § Typography). */
  tabular?: boolean;
}

export function AppText({
  variant = 'body',
  color = 'text',
  tabular = false,
  style,
  ...rest
}: AppTextProps) {
  const theme = useTheme();
  return (
    <Text
      style={[
        theme.typography[variant],
        { color: theme.colors[color] },
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
      {...rest}
    />
  );
}
