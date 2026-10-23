import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { strings } from '@/content/strings';
import { useTheme } from '@/theme/ThemeProvider';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Back button / tap outside. Defaults to onCancel; set it when Cancel does something else. */
  onDismiss?: () => void;
}

/** Says exactly what will happen; Android back = cancel (UI_UX_GUIDE.md § Safe). */
export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel = strings.common.cancel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
  onDismiss = onCancel,
}: ConfirmDialogProps) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        style={styles.backdrop}
        onPress={onDismiss}
        accessibilityLabel={strings.common.close}
      >
        <Pressable
          accessibilityRole="alert"
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.lg,
              gap: spacing.md,
            },
          ]}
        >
          <AppText variant="heading">{title}</AppText>
          <AppText color="textMuted">{body}</AppText>
          <View style={[styles.actions, { gap: spacing.sm }]}>
            <View style={styles.action}>
              <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={busy} />
            </View>
            <View style={styles.action}>
              <Button
                label={confirmLabel}
                variant={danger ? 'danger' : 'primary'}
                onPress={onConfirm}
                loading={busy}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  card: { maxWidth: 480, width: '100%', alignSelf: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  action: { flexGrow: 1, minWidth: 120 },
});
