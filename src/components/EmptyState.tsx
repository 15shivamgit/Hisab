import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/ThemeProvider';

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  const { spacing } = useTheme();
  return (
    <View style={[styles.container, { gap: spacing.sm, padding: spacing.lg }]}>
      {icon}
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      {message ? (
        <AppText color="textMuted" style={styles.center}>
          {message}
        </AppText>
      ) : null}
      {action ? (
        <View style={{ marginTop: spacing.md, alignSelf: 'stretch' }}>
          <Button label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
