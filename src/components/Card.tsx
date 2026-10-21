import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Surface with radius `lg` and padding `md`. Light: subtle shadow. Dark: border instead. */
export function Card({ children, style }: CardProps) {
  const { scheme, colors, radius, spacing } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.md,
        },
        scheme === 'light' ? { elevation: 1 } : { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}
