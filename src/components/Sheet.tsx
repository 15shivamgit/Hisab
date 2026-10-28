import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { strings } from '@/content/strings';
import { useTheme } from '@/theme/ThemeProvider';

interface SheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Bottom sheet built on Modal (no sheet library — UI_UX_GUIDE.md § Components). */
export function Sheet({ visible, title, onClose, children, footer }: SheetProps) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* A Modal is its own window: the screen does not resize for the keyboard, so the sheet
          lifts itself; otherwise the keyboard covers the amount field and Save. */}
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel={strings.common.close}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
        >
          <View style={[styles.header, { padding: spacing.md }]}>
            <AppText variant="heading" accessibilityRole="header" style={styles.title}>
              {title}
            </AppText>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={strings.common.close}
              hitSlop={12}
              style={styles.close}
            >
              <Icon name="close" />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.md }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? <View style={{ padding: spacing.md }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '85%' },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
