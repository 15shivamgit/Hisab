import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

interface ListRowProps {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

/** Icon, title, subtitle, trailing content; min height 56 dp. Wraps at large font sizes. */
export function ListRow({
  title,
  subtitle,
  left,
  right,
  onPress,
  accessibilityLabel,
  testID,
}: ListRowProps) {
  const { colors, spacing } = useTheme();
  const content = (
    <>
      {left}
      <View style={styles.text}>
        <AppText numberOfLines={1}>{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </>
  );
  const style = [styles.row, { gap: spacing.md, paddingVertical: spacing.sm }];
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: colors.border }}
      style={style}
      testID={testID}
    >
      {content}
    </Pressable>
  ) : (
    <View style={style} accessibilityLabel={accessibilityLabel} testID={testID}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  text: { flex: 1, minWidth: 120 },
});
