import { Stack, usePreventRemove, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, StyleSheet, View } from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState } from '@/components/ErrorState';
import { useToast } from '@/components/Toast';
import { strings } from '@/content/strings';
import { categoryRepository } from '@/db/repositories/categoryRepository';
import { transactionRepository } from '@/db/repositories/transactionRepository';
import type { Attachment, TxnType } from '@/db/types';
import { ReceiptsField } from '@/features/receipts/components/ReceiptsField';
import { useReceiptPicker } from '@/features/receipts/useReceiptPicker';
import { TransactionForm } from '@/features/transactions/components/TransactionForm';
import {
  emptyFormValues,
  toFormValues,
  toNewTransaction,
  type TransactionFormValues,
} from '@/features/transactions/schema';
import { useDb } from '@/hooks/DatabaseContext';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useToday } from '@/hooks/useToday';
import { systemClock } from '@/lib/clock';
import { categoryService } from '@/services/categoryService';
import type { ReceiptDraft } from '@/services/receiptService';
import { receipts } from '@/services/receipts';
import { transactionService } from '@/services/transactionService';
import { useTheme } from '@/theme/ThemeProvider';

type EditorProps =
  { mode: 'new'; type: TxnType; duplicateOf?: string } | { mode: 'edit'; id: string };

export function TransactionEditorScreen(props: EditorProps) {
  const db = useDb();
  const router = useRouter();
  const toast = useToast();
  const today = useToday();
  const { colors, spacing } = useTheme();

  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // The blocked "go back" waiting for the Discard dialog.
  const [pendingLeave, setPendingLeave] = useState<{ repeat: () => void } | null>(null);

  const editId = props.mode === 'edit' ? props.id : undefined;
  const duplicateOf = props.mode === 'new' ? props.duplicateOf : undefined;
  const newType = props.mode === 'new' ? props.type : undefined;

  // Receipt changes apply only when the form is saved (RECEIPTS.md § Replace / delete).
  const [drafts, setDrafts] = useState<ReceiptDraft[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const picker = useReceiptPicker((added) => setDrafts((list) => [...list, ...added]));

  // Staged photos of a form that is left without saving are deleted.
  const draftsRef = useRef<ReceiptDraft[]>([]);
  const savedRef = useRef(false);
  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);
  useEffect(
    () => () => {
      if (!savedRef.current) receipts.discard(draftsRef.current);
    },
    [],
  );

  // A photo taken just before Android killed the app comes back here (new entries only).
  const isNew = props.mode === 'new';
  useEffect(() => {
    if (isNew) void picker.recoverPending(5);
    // Run once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loaded once; the form keeps its own state after that.
  const data = useDbQuery(
    async (client) => {
      const [categories, recentExpense, recentIncome, lastMethod] = await Promise.all([
        categoryRepository.list(client, { includeArchived: true }),
        transactionRepository.recentCategoryIds(client, 'expense'),
        transactionRepository.recentCategoryIds(client, 'income'),
        transactionRepository.lastPaymentMethod(client),
      ]);
      let initialValues: TransactionFormValues;
      let attachments: Attachment[] = [];
      if (editId) {
        const existing = await transactionRepository.getById(client, editId);
        if (!existing) return { notFound: true as const };
        initialValues = toFormValues(existing);
        attachments = existing.attachments;
      } else if (duplicateOf) {
        initialValues = toFormValues(
          await transactionService.duplicate(client, systemClock, duplicateOf),
        );
      } else {
        initialValues = emptyFormValues(newType ?? 'expense', today, lastMethod ?? 'cash');
      }
      return {
        notFound: false as const,
        categories,
        recent: { expense: recentExpense, income: recentIncome },
        initialValues,
        attachments,
      };
    },
    [editId, duplicateOf, newType],
    { tables: [] },
  );

  const hasChanges = dirty || drafts.length > 0 || removedIds.length > 0;
  usePreventRemove(hasChanges && !leaving, ({ repeat }) => setPendingLeave({ repeat }));

  useEffect(() => {
    if (leaving) router.back();
  }, [leaving, router]);

  const onDirtyChange = useCallback((value: boolean) => setDirty(value), []);

  const onSubmit = async (values: TransactionFormValues) => {
    const input = toNewTransaction(values);
    if (editId) {
      await transactionService.update(db, systemClock, editId, input, {
        receipts,
        add: drafts,
        remove: removedIds,
      });
      toast(strings.txn.updated);
    } else {
      await transactionService.create(db, systemClock, input, { receipts, add: drafts });
      toast(strings.txn.saved[input.type]);
    }
    savedRef.current = true;
    setLeaving(true);
  };

  const title = editId
    ? strings.txn.editTitle
    : newType === 'income'
      ? strings.txn.newIncome
      : strings.txn.newExpense;

  let body;
  if (data.status === 'loading') {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  } else if (data.status === 'error' || data.data.notFound) {
    body = (
      <ErrorState
        title={data.status === 'error' ? strings.common.loadFailed : strings.txn.notFound}
        message={data.status === 'error' ? strings.common.somethingWrong : ''}
        onRetry={data.status === 'error' ? data.reload : undefined}
      />
    );
  } else {
    const loaded = data.data;
    body = (
      <TransactionForm
        initialValues={loaded.initialValues}
        categories={loaded.categories}
        recentCategoryIds={loaded.recent}
        today={today}
        submitLabel={strings.common.save}
        onSubmit={onSubmit}
        onDirtyChange={onDirtyChange}
        onCreateCategory={(type, values) =>
          categoryService.create(db, systemClock, { ...values, type })
        }
        receipts={
          <ReceiptsField
            existing={loaded.attachments.filter((a) => !removedIds.includes(a.id))}
            drafts={drafts}
            processing={picker.processing}
            resolveUri={(path) => receipts.resolveUri(path)}
            onAdd={picker.open}
            onRemoveExisting={(id) => setRemovedIds((ids) => [...ids, id])}
            onRemoveDraft={(draft) => {
              receipts.discard([draft]);
              setDrafts((list) => list.filter((d) => d !== draft));
            }}
          />
        }
      />
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ title }} />
      <View style={[styles.fill, { paddingBottom: spacing.xs }]}>{body}</View>
      <ConfirmDialog
        visible={pendingLeave !== null}
        title={strings.txn.discardTitle}
        body={strings.txn.discardBody}
        confirmLabel={strings.txn.discard}
        cancelLabel={strings.txn.keepEditing}
        danger
        onCancel={() => setPendingLeave(null)}
        onConfirm={() => {
          const leave = pendingLeave;
          setPendingLeave(null);
          receipts.discard(drafts);
          setDrafts([]);
          setRemovedIds([]);
          setDirty(false);
          leave?.repeat();
        }}
      />
      {picker.element}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
