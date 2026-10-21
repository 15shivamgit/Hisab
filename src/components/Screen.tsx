import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

interface ScreenProps {
  /** Large title at the top. Tab screens have no native header, so they pass one. */
  title?: string;
  scroll?: boolean;
  /** For forms: keeps inputs and the Save button above the keyboard. */
  keyboardAvoiding?: boolean;
  /** Tab screens skip the bottom edge — the tab bar already handles it. */
  edges?: Edge[];
  children: ReactNode;
}

export function Screen({
  title,
  scroll = false,
  keyboardAvoiding = false,
  edges = ['top', 'left', 'right'],
  children,
}: ScreenProps) {
  const { colors, spacing } = useTheme();

  const header = title ? (
    <AppText variant="title" accessibilityRole="header" style={{ marginBottom: spacing.md }}>
      {title}
    </AppText>
  ) : null;

  const content = scroll ? (
    <ScrollView contentContainerStyle={{ padding: spacing.md }} keyboardShouldPersistTaps="handled">
      {header}
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, { padding: spacing.md }]}>
      {header}
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.fill, { backgroundColor: colors.bg }]}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView behavior="padding" style={styles.fill}>
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
