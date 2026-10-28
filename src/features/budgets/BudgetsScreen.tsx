// Budgets (BUDGETS.md, BUD-01…04): overall monthly budget and per-category budgets.

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AmountInput } from '@/components/AmountInput';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Chip } from '@/components/Chip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { errorText, strings } from '@/content/strings';
import type { Category } from '@/db/types';
import { useDb } from '@/hooks/DatabaseContext';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useToday } from '@/hooks/useToday';
import { systemClock } from '@/lib/clock';
import { formatMonthYear } from '@/lib/dates';
import { formatPaise, paiseToInputText, parseRupeesToPaise } from '@/lib/money';
import { budgetService, type BudgetLine } from '@/services/budgetService';
import { diagnostics } from '@/services/diagnostics';
import { useTheme } from '@/theme/ThemeProvider';

const money = (paise: number) => formatPaise(paise, { compact: true });

/** "₹8,200 of ₹10,000 · ₹1,800 left" / "… · ₹1,200 over" — numbers, never colour alone. */
export function BudgetNumbers({ line }: { line: BudgetLine }) {
  const { progress } = line;
  const tail =
    progress.state === 'over'
      ? strings.budgets.over(money(-progress.remainingPaise))
      : progress.state === 'warning'
        ? `${strings.budgets.used(progress.percent)} · ${strings.budgets.left(money(progress.remainingPaise))}`
        : strings.budgets.left(money(progress.remainingPaise));
  return (
    <AppText
      variant="caption"
      color={
        progress.state === 'over'
          ? 'danger'
          : progress.state === 'warning'
            ? 'warning'
            : 'textMuted'
      }
    >
      {`${strings.budgets.spentOf(money(line.spentPaise), money(line.budget.amountPaise))} · ${tail}`}
    </AppText>
  );
}

type Editing =
  | { kind: 'overall'; line: BudgetLine | null }
  | { kind: 'category'; line: BudgetLine }
  | { kind: 'add'; available: Category[] };

export function BudgetsScreen() {
  const db = useDb();
  const today = useToday();
  const toast = useToast();
  const { spacing } = useTheme();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<BudgetLine | null>(null);

  const query = useDbQuery((client) => budgetService.getOverview(client, today), [today], {
    tables: ['budgets', 'transactions', 'categories'],
  });

  if (query.status === 'loading') {
    return (
      <Screen scroll>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={96} />
          <Skeleton height={64} />
        </View>
      </Screen>
    );
  }
  if (query.status === 'error') {
    return (
      <Screen>
        <ErrorState
          title={strings.common.loadFailed}
          message={strings.common.somethingWrong}
          onRetry={query.reload}
        />
      </Screen>
    );
  }

  const o = query.data;
  const nothing = !o.overall && o.categories.length === 0;

  return (
    <Screen scroll>
      {nothing ? (
        <EmptyState
          title={strings.budgets.emptyTitle}
          message={strings.budgets.emptyMessage}
          action={{
            label: strings.budgets.setBudget,
            onPress: () => setEditing({ kind: 'overall', line: null }),
          }}
        />
      ) : (
        <View style={{ gap: spacing.lg }}>
          <AppText variant="caption" color="textMuted">
            {formatMonthYear(today)}
          </AppText>
          <Card style={{ gap: spacing.sm }}>
            <AppText variant="heading">{strings.budgets.overall}</AppText>
            {o.overall ? (
              <>
                <AppText variant="title">{money(o.overall.budget.amountPaise)}</AppText>
                <ProgressBar
                  percent={o.overall.progress.percent}
                  state={o.overall.progress.state}
                />
                <BudgetNumbers line={o.overall} />
                <View style={[styles.row, { gap: spacing.sm }]}>
                  <Button
                    label={strings.budgets.edit}
                    variant="secondary"
                    onPress={() => setEditing({ kind: 'overall', line: o.overall })}
                  />
                  <Button
                    label={strings.budgets.remove}
                    variant="ghost"
                    onPress={() => setRemoving(o.overall)}
                  />
                </View>
              </>
            ) : (
              <Button
                label={strings.budgets.setOverall}
                variant="secondary"
                onPress={() => setEditing({ kind: 'overall', line: null })}
              />
            )}
          </Card>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="heading">{strings.budgets.categoryBudgets}</AppText>
            {o.categoriesExceedOverall ? (
              <AppText variant="caption" color="warning">
                {strings.budgets.exceedHint}
              </AppText>
            ) : null}
            {o.categories.map((line) => (
              <Pressable
                key={line.budget.id}
                onPress={() => setEditing({ kind: 'category', line })}
                accessibilityRole="button"
                accessibilityLabel={`${line.category?.name ?? ''}, ${strings.budgets.spentOf(money(line.spentPaise), money(line.budget.amountPaise))}`}
              >
                <Card style={{ gap: spacing.sm }}>
                  <View style={[styles.row, { gap: spacing.md }]}>
                    {line.category ? (
                      <CategoryIcon
                        icon={line.category.icon}
                        color={line.category.color}
                        size={36}
                      />
                    ) : null}
                    <AppText variant="bodyStrong" style={styles.fill}>
                      {line.category?.name ?? ''}
                    </AppText>
                    <AppText variant="bodyStrong">{money(line.budget.amountPaise)}</AppText>
                  </View>
                  <ProgressBar percent={line.progress.percent} state={line.progress.state} />
                  <BudgetNumbers line={line} />
                </Card>
              </Pressable>
            ))}
            {o.available.length > 0 ? (
              <Button
                label={strings.budgets.addCategory}
                variant="ghost"
                onPress={() => setEditing({ kind: 'add', available: o.available })}
              />
            ) : (
              <AppText variant="caption" color="textMuted">
                {strings.budgets.allHaveBudgets}
              </AppText>
            )}
          </View>
          <AppText variant="caption" color="textMuted">
            {strings.budgets.rules}
          </AppText>
        </View>
      )}

      {editing ? (
        <BudgetSheet
          editing={editing}
          onClose={() => setEditing(null)}
          onRemove={(line) => {
            setEditing(null);
            setRemoving(line);
          }}
          onSave={async (categoryId, amountPaise) => {
            if (categoryId)
              await budgetService.setForCategory(db, systemClock, categoryId, amountPaise);
            else await budgetService.setOverall(db, systemClock, amountPaise);
            setEditing(null);
            toast(strings.budgets.saved);
          }}
        />
      ) : null}

      <ConfirmDialog
        visible={removing !== null}
        title={strings.budgets.removeTitle(removing?.category?.name ?? strings.budgets.overallName)}
        body={strings.budgets.removeBody}
        confirmLabel={strings.budgets.remove}
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const line = removing;
          setRemoving(null);
          if (!line) return;
          budgetService.remove(db, systemClock, line.budget.id).then(
            () => toast(strings.budgets.removed),
            (error: unknown) => {
              void diagnostics.record(error, 'budgets.remove');
              toast(strings.common.somethingWrong);
            },
          );
        }}
      />
    </Screen>
  );
}

function BudgetSheet({
  editing,
  onClose,
  onSave,
  onRemove,
}: {
  editing: Editing;
  onClose: () => void;
  onSave: (categoryId: string | null, amountPaise: number) => Promise<void>;
  onRemove: (line: BudgetLine) => void;
}) {
  const { spacing } = useTheme();
  const existing = editing.kind === 'add' ? null : editing.line;
  const [amountText, setAmountText] = useState(
    existing ? paiseToInputText(existing.budget.amountPaise) : '',
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    editing.kind === 'category' ? (editing.line.budget.categoryId ?? null) : null,
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const title =
    editing.kind === 'overall'
      ? strings.budgets.overall
      : editing.kind === 'category'
        ? (editing.line.category?.name ?? strings.budgets.categoryBudgets)
        : strings.budgets.chooseCategory;

  const save = async () => {
    const amount = parseRupeesToPaise(amountText);
    if (!amount.ok) {
      setError(errorText(amount.error));
      return;
    }
    if (editing.kind === 'add' && !categoryId) {
      setError(errorText('category.required'));
      return;
    }
    setSaving(true);
    try {
      await onSave(editing.kind === 'overall' ? null : categoryId, amount.value);
    } catch (e) {
      void diagnostics.record(e, 'budgets.save');
      setError(strings.common.somethingWrong);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible title={title} onClose={onClose}>
      <View style={{ gap: spacing.lg }}>
        {editing.kind === 'add' ? (
          <View style={[styles.wrap, { gap: spacing.sm }]} accessibilityRole="radiogroup">
            {editing.available.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected={categoryId === c.id}
                role="radio"
                onPress={() => {
                  setCategoryId(c.id);
                  setError(undefined);
                }}
                icon={<CategoryIcon icon={c.icon} color={c.color} size={24} />}
              />
            ))}
          </View>
        ) : null}
        <AmountInput
          label={strings.budgets.amount}
          value={amountText}
          onChangeText={(t) => {
            setAmountText(t);
            setError(undefined);
          }}
          error={error}
          autoFocus={editing.kind !== 'add'}
        />
        <Button label={strings.common.save} onPress={() => void save()} loading={saving} />
        {existing && editing.kind === 'category' ? (
          <Button
            label={strings.budgets.remove}
            variant="ghost"
            onPress={() => onRemove(existing)}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
