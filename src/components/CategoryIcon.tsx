import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { categoryColors, radius, type CategoryColorToken } from '@/theme/tokens';

export function categoryColor(token: string): string {
  return categoryColors[token as CategoryColorToken] ?? categoryColors['cat.slate'];
}

/** Category icon on a soft circle of the category colour (DESIGN_TOKENS.md § categories). */
export function CategoryIcon({
  icon,
  color,
  size = 40,
}: {
  icon: string;
  color: string;
  size?: number;
}) {
  const hex = categoryColor(color);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: `${hex}33`, // 20% opacity
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.55)} color={hex} />
    </View>
  );
}
