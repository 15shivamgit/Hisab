import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/AmountText';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState } from '@/components/ErrorState';
import { useToast } from '@/components/Toast';
import { strings } from '@/content/strings';
import { transactionRepository } from '@/db/repositories/transactionRepository';
import { useDb } from '@/hooks/DatabaseContext';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useToday } from '@/hooks/useToday';
import { systemClock } from '@/lib/clock';
import { formatDateTime, formatLocalDate } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { ReceiptThumb } from '@/features/receipts/components/ReceiptThumb';
import { receipts } from '@/services/receipts';
import { transactionService } from '@/services/transactionService';
import { useTheme } from '@/theme/ThemeProvider';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <AppText>{value}</AppText>
    </View>
  );
}

export function TransactionDetailScreen({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const toast = useToast();
  const today = useToday();
  const { colors, spacing } = useTheme();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const query = useDbQuery((client) => transactionRepository.getById(client, id), [id], {
    tables: ['transactions', 'transaction_attachments', 'categories'],
  });

  // Deleted elsewhere (or a stale link): tell the user and go back (TRANSACTIONS.md edge cases).
  const missing = query.status === 'success' && query.data === null && !deleting;
  useEffect(() => {
    if (missing) {
      toast(strings.txn.notFound);
      router.back();
    }
  }, [missing, router, toast]);

  if (query.status === 'loading' || missing || (query.status === 'success' && !query.data)) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Stack.Screen options={{ title: strings.txn.detailTitle }} />
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (query.status === 'error') {
    return (
      <View style={[styles.fill, { backgroundColor: colors.bg }]}>
        <Stack.Screen options={{ title: strings.txn.detailTitle }} />
        <ErrorState
          title={strings.common.loadFailed}
          message={strings.common.somethingWrong}
          onRetry={query.reload}
        />
      </View>
    );
  }

  const t = query.data;
  if (!t) return null; // Handled above; this narrows the type.
  const upcoming = t.txnDate > today;

  const onDelete = async () => {
    setDeleting(true);
    try {
      await transactionService.delete(db, systemClock, t.id, receipts);
      setConfirmDelete(false);
      toast(strings.txn.deleted);
      router.back();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
      toast(strings.common.somethingWrong);
    }
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ title: strings.txnType[t.type] }} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <Card style={{ gap: spacing.md }}>
          <View style={[styles.row, { gap: spacing.md }]}>
            <CategoryIcon icon={t.categoryIcon} color={t.categoryColor} size={48} />
            <View style={styles.fill}>
              <AppText variant="heading">{t.description ?? t.categoryName}</AppText>
              {t.description ? <AppText color="textMuted">{t.categoryName}</AppText> : null}
            </View>
          </View>
          <AmountText paise={t.amountPaise} kind={t.type} variant="display" />
          {upcoming ? (
            <AppText color="warning">
              {strings.txn.upcoming} · {strings.txn.countedOn(formatLocalDate(t.txnDate, 'short'))}
            </AppText>
          ) : null}
        </Card>
        <Card style={{ gap: spacing.md }}>
          <Field label={strings.txn.date} value={formatLocalDate(t.txnDate, 'long')} />
          <Field label={strings.txn.paymentMethod} value={strings.paymentMethod[t.paymentMethod]} />
          {t.description ? <Field label={strings.txn.description} value={t.description} /> : null}
          {t.notes ? <Field label={strings.txn.notes} value={t.notes} /> : null}
          {t.attachments.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="caption" color="textMuted">
                {strings.txn.receipts}
              </AppText>
              <View style={[styles.wrap, { gap: spacing.md }]}>
                {t.attachments.map((a, index) => (
                  <ReceiptThumb
                    key={a.id}
                    uri={receipts.resolveUri(a.relativePath)}
                    accessibilityLabel={`${strings.receipts.title} ${index + 1}`}
                    onPress={() =>
                      router.push({
                        pathname: '/receipt/[transactionId]',
                        params: { transactionId: t.id, index: String(index) },
                      })
                    }
                  />
                ))}
              </View>
            </View>
          ) : null}
          <Field label={strings.txn.created} value={formatDateTime(t.createdAt)} />
          {t.updatedAt !== t.createdAt ? (
            <Field label={strings.txn.lastUpdated} value={formatDateTime(t.updatedAt)} />
          ) : null}
        </Card>
        <View style={{ gap: spacing.sm }}>
          <Button
            label={strings.common.edit}
            onPress={() =>
              router.push({ pathname: '/transaction/[id]/edit', params: { id: t.id } })
            }
          />
          <Button
            label={strings.txn.duplicate}
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/transaction/new',
                params: { type: t.type, duplicateOf: t.id },
              })
            }
          />
          <Button
            label={strings.common.delete}
            variant="danger"
            onPress={() => setConfirmDelete(true)}
          />
        </View>
      </ScrollView>
      <ConfirmDialog
        visible={confirmDelete}
        title={strings.txn.deleteTitle}
        body={strings.txn.deleteBody(
          strings.txnType[t.type],
          formatPaise(t.amountPaise, { compact: true }),
          t.attachments.length,
        )}
        confirmLabel={strings.common.delete}
        danger
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={onDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
