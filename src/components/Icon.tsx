import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

interface IconProps {
  /** Material Symbols name, e.g. 'restaurant'. */
  name: string;
  size?: number;
  color?: ColorValue;
}

/** Material Symbols icon (bundled font, no network). Decorative: give the parent a label. */
export function Icon({ name, size = 24, color }: IconProps) {
  const { colors } = useTheme();
  return (
    <SymbolView
      name={{ android: name as AndroidSymbol }}
      size={size}
      tintColor={color ?? colors.text}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
