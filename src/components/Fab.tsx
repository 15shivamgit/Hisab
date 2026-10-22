import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';

/** Floating "+" button on list screens. */
export function Fab({
  onPress,
  accessibilityLabel,
  aboveSystemBar = false,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  /**
   * Stack screens draw under the system gesture bar (edge-to-edge), so the button must
   * sit above it. Tab screens don't need this — the tab bar already takes that space.
   */
  aboveSystemBar?: boolean;
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = spacing.md + (aboveSystemBar ? insets.bottom : 0);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      // Bounded ripple clipped to the circle: a borderless ripple on a rounded view
      // drew artefacts and could hide the background on Android.
      android_ripple={{ color: colors.primarySoft }}
      style={[styles.fab, { backgroundColor: colors.primary, right: spacing.md, bottom }]}
    >
      <Icon name="add" size={28} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 4,
  },
});
