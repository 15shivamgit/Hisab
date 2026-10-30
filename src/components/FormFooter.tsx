import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Sticky Save area at the bottom of a form. The app draws edge-to-edge, so the footer adds
 * the bottom inset itself; without it the button sat under Android's 3-button navigation
 * bar and taps on it went to the system (found on Android 8 in Phase 10).
 */
export function FormFooter({ error, children }: { error?: string; children: ReactNode }) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.footer,
        {
          padding: spacing.md,
          paddingBottom: spacing.md + insets.bottom,
          gap: spacing.sm,
          borderTopColor: colors.border,
          backgroundColor: colors.bg,
        },
      ]}
    >
      {error ? (
        <AppText color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ footer: { borderTopWidth: StyleSheet.hairlineWidth } });
