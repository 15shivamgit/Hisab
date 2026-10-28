import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import { useWindowDimensions, type ColorValue } from 'react-native';

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
  // On Android the icon is a font glyph that grows with the system font size, but its box
  // stays `size`; grow the box the same way so the glyph is never clipped.
  const { fontScale } = useWindowDimensions();
  const box = Math.ceil(size * Math.max(1, fontScale));
  return (
    <SymbolView
      name={{ android: name as AndroidSymbol }}
      size={size}
      style={{ width: box, height: box }}
      tintColor={color ?? colors.text}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
