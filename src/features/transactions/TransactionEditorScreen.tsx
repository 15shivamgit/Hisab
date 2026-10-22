import { Stack, usePreventRemove, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, StyleSheet, View } from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState } from '@/components/ErrorState';
import { useToast } from '@/components/Toast';
import { strings } from '@/content/strings';
import { categoryRepository } from '@/db/repositories/categoryRepository';
import { transactionRepository } from '@/db/repositories/transactionRepository';
import type { TxnType } from '@/db/types';
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
      if (editId) {
        const existing = await transactionRepository.getById(client, editId);
        if (!existing) return { notFound: true as const };
        initialValues = toFormValues(existing);
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
      };
    },
    [editId, duplicateOf, newType],
    { tables: [] },
  );

  usePreventRemove(dirty && !leaving, ({ repeat }) => setPendingLeave({ repeat }));

  useEffect(() => {
    if (leaving) router.back();
  }, [leaving, router]);

  const onDirtyChange = useCallback((value: boolean) => setDirty(value), []);

  const onSubmit = async (values: TransactionFormValues) => {
    const input = toNewTransaction(values);
    if (editId) {
      await transactionService.update(db, systemClock, editId, input);
      toast(strings.txn.updated);
    } else {
      await transactionService.create(db, systemClock, input);
      toast(strings.txn.saved[input.type]);
    }
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
          setDirty(false);
          leave?.repeat();
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
