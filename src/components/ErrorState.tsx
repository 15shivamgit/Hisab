import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/ThemeProvider';

interface ErrorStateProps {
  title: string;
  /** Plain-language message — never raw error text. */
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  secondaryAction?: { label: string; onPress: () => void };
}

export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = 'Try again',
  secondaryAction,
}: ErrorStateProps) {
  const { spacing } = useTheme();
  return (
    <View
      style={[styles.container, { gap: spacing.sm, padding: spacing.lg }]}
      accessibilityRole="alert"
    >
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      <AppText color="textMuted" style={styles.center}>
        {message}
      </AppText>
      <View style={{ marginTop: spacing.md, alignSelf: 'stretch', gap: spacing.sm }}>
        {onRetry ? <Button label={retryLabel} onPress={onRetry} /> : null}
        {secondaryAction ? (
          <Button
            label={secondaryAction.label}
            onPress={secondaryAction.onPress}
            variant="secondary"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
