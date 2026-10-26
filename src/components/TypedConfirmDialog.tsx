import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { strings } from '@/content/strings';
import { useTheme } from '@/theme/ThemeProvider';

interface TypedConfirmDialogProps {
  visible: boolean;
  title: string;
  body: string;
  /** The confirm button stays disabled until this word is typed (any case). */
  word: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional extra action, e.g. "Create backup first". */
  extra?: { label: string; onPress: () => void };
}

/** For actions that replace or delete everything (BAK-02, SET-06). */
export function TypedConfirmDialog(props: TypedConfirmDialogProps) {
  // Remount on open so the typed word never carries over.
  return props.visible ? <DialogBody {...props} /> : null;
}

function DialogBody({
  title,
  body,
  word,
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
  extra,
}: TypedConfirmDialogProps) {
  const { colors, radius, spacing } = useTheme();
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toUpperCase() === word;
  const cancel = () => {
    if (!busy) onCancel();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={cancel}>
      <Pressable style={styles.backdrop} onPress={cancel} accessibilityLabel={strings.common.close}>
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
          <TextField
            label={strings.backup.typeToConfirm(word)}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
          />
          {extra ? (
            <Button label={extra.label} variant="ghost" onPress={extra.onPress} disabled={busy} />
          ) : null}
          <View style={[styles.actions, { gap: spacing.sm }]}>
            <View style={styles.action}>
              <Button
                label={strings.common.cancel}
                variant="secondary"
                onPress={cancel}
                disabled={busy}
              />
            </View>
            <View style={styles.action}>
              <Button
                label={confirmLabel}
                variant="danger"
                onPress={onConfirm}
                disabled={!matches}
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
