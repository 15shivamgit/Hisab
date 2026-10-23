import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { strings } from '@/content/strings';
import { MAX_ATTACHMENTS_PER_TRANSACTION } from '@/db/repositories/attachmentRepository';
import type { Attachment } from '@/db/types';
import { ReceiptThumb, THUMB_SIZE } from '@/features/receipts/components/ReceiptThumb';
import type { ReceiptDraft } from '@/services/receiptService';
import { useTheme } from '@/theme/ThemeProvider';

interface ReceiptsFieldProps {
  /** Already-saved receipts still on this entry (edit form). */
  existing: readonly Attachment[];
  drafts: readonly ReceiptDraft[];
  processing: number;
  resolveUri: (relativePath: string) => string | null;
  onAdd: (remaining: number) => void;
  onRemoveExisting: (attachmentId: string) => void;
  onRemoveDraft: (draft: ReceiptDraft) => void;
}

/** Thumbnails + "Add receipt" in the transaction form (max 5, RCP-02). */
export function ReceiptsField({
  existing,
  drafts,
  processing,
  resolveUri,
  onAdd,
  onRemoveExisting,
  onRemoveDraft,
}: ReceiptsFieldProps) {
  const { colors, radius, spacing } = useTheme();
  const count = existing.length + drafts.length;
  const remaining = MAX_ATTACHMENTS_PER_TRANSACTION - count - processing;

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label" color="textMuted">
        {strings.receipts.count(count, MAX_ATTACHMENTS_PER_TRANSACTION)}
      </AppText>
      <View style={[styles.row, { gap: spacing.md }]}>
        {existing.map((a, i) => (
          <ReceiptThumb
            key={a.id}
            uri={resolveUri(a.relativePath)}
            accessibilityLabel={`${strings.receipts.title} ${i + 1}`}
            onRemove={() => onRemoveExisting(a.id)}
          />
        ))}
        {drafts.map((d, i) => (
          <ReceiptThumb
            key={d.stagedUri}
            uri={d.stagedUri}
            accessibilityLabel={`${strings.receipts.title} ${existing.length + i + 1}`}
            onRemove={() => onRemoveDraft(d)}
          />
        ))}
        {Array.from({ length: processing }, (_, i) => (
          <View
            key={`p${i}`}
            accessibilityLabel={strings.receipts.processing}
            style={[styles.tile, { borderRadius: radius.md, backgroundColor: colors.surfaceAlt }]}
          >
            <ActivityIndicator color={colors.primary} />
          </View>
        ))}
        {remaining > 0 ? (
          <Pressable
            onPress={() => onAdd(remaining)}
            accessibilityRole="button"
            accessibilityLabel={strings.receipts.add}
            testID="add-receipt"
            style={[
              styles.tile,
              styles.add,
              { borderRadius: radius.md, borderColor: colors.primary },
            ]}
          >
            <Icon name="add_a_photo" color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: THUMB_SIZE, height: THUMB_SIZE, alignItems: 'center', justifyContent: 'center' },
  add: { borderWidth: 1.5, borderStyle: 'dashed' },
});
