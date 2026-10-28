import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { strings } from '@/content/strings';
import { useTheme } from '@/theme/ThemeProvider';

/** Covers the whole app while locked. Shows no amounts, names, or counts. */
export function LockScreen({ busy, onUnlock }: { busy: boolean; onUnlock: () => void }) {
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]}>
      <View style={[styles.center, { gap: spacing.md, padding: spacing.xl }]}>
        <Icon name="lock" size={56} color={colors.primary} />
        <AppText variant="title" accessibilityRole="header" style={styles.text}>
          {strings.lock.title}
        </AppText>
        <AppText color="textMuted" style={styles.text}>
          {strings.lock.message}
        </AppText>
        <View style={{ alignSelf: 'stretch', marginTop: spacing.md }}>
          <Button label={strings.lock.unlock} onPress={onUnlock} loading={busy} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { textAlign: 'center' },
});
