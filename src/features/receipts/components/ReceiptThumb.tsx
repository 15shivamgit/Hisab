import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { strings } from '@/content/strings';
import { useTheme } from '@/theme/ThemeProvider';

export const THUMB_SIZE = 72;

interface ReceiptThumbProps {
  /** null = the file is missing on disk (RCP-06): show a placeholder, never crash. */
  uri: string | null;
  onPress?: () => void;
  onRemove?: () => void;
  accessibilityLabel: string;
}

export function ReceiptThumb({ uri, onPress, onRemove, accessibilityLabel }: ReceiptThumbProps) {
  const { colors, radius } = useTheme();
  return (
    <View>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : 'image'}
        accessibilityLabel={uri ? accessibilityLabel : strings.receipts.missing}
        style={[
          styles.thumb,
          {
            borderRadius: radius.md,
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.border,
          },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.missing}>
            <Icon name="hide_image" size={22} color={colors.textMuted} />
            <AppText variant="caption" color="textMuted" style={styles.center}>
              {strings.receipts.missing}
            </AppText>
          </View>
        )}
      </Pressable>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={strings.receipts.remove}
          hitSlop={8}
          style={[styles.remove, { backgroundColor: colors.text }]}
        >
          <Icon name="close" size={14} color={colors.bg} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  image: { width: '100%', height: '100%' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  center: { textAlign: 'center', fontSize: 10, lineHeight: 12 },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
