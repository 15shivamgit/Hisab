import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AmountInput } from '@/components/AmountInput';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Chip } from '@/components/Chip';
import { DateField } from '@/components/DateField';
import { Icon } from '@/components/Icon';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { errorText, strings } from '@/content/strings';
import type { Category, TxnType } from '@/db/types';
import { PAYMENT_METHODS } from '@/db/types';
import {
  CategoryFormSheet,
  type CategoryFormValues,
} from '@/features/categories/components/CategoryFormSheet';
import { transactionFormSchema, type TransactionFormValues } from '@/features/transactions/schema';
import { formatLocalDate, type LocalDate } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';

export interface TransactionFormProps {
  initialValues: TransactionFormValues;
  /** All categories (both types, archived included). */
  categories: readonly Category[];
  /** Most recently used category ids per type, newest first. */
  recentCategoryIds: Record<TxnType, readonly string[]>;
  today: LocalDate;
  submitLabel: string;
  /** Throw to show an error above the Save button. */
  onSubmit: (values: TransactionFormValues) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  /** Quick-create from the category chips ("+ New"). Returns the new category. */
  onCreateCategory: (type: TxnType, values: CategoryFormValues) => Promise<Category>;
  /** Receipts section (state lives in the editor screen; RECEIPTS.md). */
  receipts?: ReactNode;
}

const TYPE_OPTIONS = [
  { value: 'expense', label: strings.txnType.expense },
  { value: 'income', label: strings.txnType.income },
] as const;

export function TransactionForm({
  initialValues,
  categories,
  recentCategoryIds,
  today,
  submitLabel,
  onSubmit,
  onDirtyChange,
  onCreateCategory,
  receipts,
}: TransactionFormProps) {
  const { colors, spacing } = useTheme();
  const [submitError, setSubmitError] = useState<string>();
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [extraCategories, setExtraCategories] = useState<Category[]>([]);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<TransactionFormValues>({
    defaultValues: initialValues,
    resolver: zodResolver(transactionFormSchema),
  });

  const type = useWatch({ control, name: 'type' });
  const categoryId = useWatch({ control, name: 'categoryId' });
  const txnDate = useWatch({ control, name: 'txnDate' });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const allCategories = useMemo(
    () => [...categories, ...extraCategories.filter((e) => !categories.some((c) => c.id === e.id))],
    [categories, extraCategories],
  );

  // Active categories of this type, last-used first; an archived one stays visible
  // only when it is the one already on this entry (TRANSACTIONS.md § form).
  const choices = useMemo(() => {
    const recent = recentCategoryIds[type];
    const rank = (id: string) => {
      const i = recent.indexOf(id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return allCategories
      .filter((c) => c.type === type && (c.archivedAt === null || c.id === categoryId))
      .sort((a, b) => rank(a.id) - rank(b.id) || a.sortOrder - b.sortOrder);
  }, [allCategories, recentCategoryIds, type, categoryId]);

  const changeType = (next: TxnType) => {
    setValue('type', next, { shouldDirty: true });
    const current = allCategories.find((c) => c.id === categoryId);
    if (current && current.type !== next) setValue('categoryId', '', { shouldDirty: true });
  };

  const submit = handleSubmit(async (values) => {
    setSubmitError(undefined);
    try {
      await onSubmit(values);
    } catch {
      setSubmitError(strings.common.somethingWrong);
    }
  });

  return (
    <View style={styles.fill}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <SegmentedControl
          options={TYPE_OPTIONS}
          value={type}
          onChange={changeType}
          accessibilityLabel={strings.txn.type}
        />

        <Controller
          control={control}
          name="amountText"
          render={({ field }) => (
            <AmountInput
              label={strings.txn.amount}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errorText(errors.amountText?.message)}
              autoFocus={initialValues.amountText === ''}
            />
          )}
        />

        <View style={{ gap: spacing.sm }}>
          <AppText variant="label" color="textMuted">
            {strings.txn.category}
          </AppText>
          <View style={[styles.wrap, { gap: spacing.sm }]} accessibilityRole="radiogroup">
            {choices.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected={c.id === categoryId}
                onPress={() =>
                  setValue('categoryId', c.id, { shouldDirty: true, shouldValidate: true })
                }
                icon={<CategoryIcon icon={c.icon} color={c.color} size={24} />}
                testID={`category-chip-${c.name}`}
              />
            ))}
            <Chip
              label={strings.txn.newCategory}
              role="button"
              onPress={() => setCreatingCategory(true)}
              icon={<Icon name="add" size={20} color={colors.primary} />}
              accessibilityLabel={strings.categories.add}
            />
          </View>
          {errors.categoryId ? (
            <AppText variant="caption" color="danger">
              {errorText(errors.categoryId.message)}
            </AppText>
          ) : null}
        </View>

        <Controller
          control={control}
          name="txnDate"
          render={({ field }) => (
            <DateField
              label={strings.txn.date}
              value={field.value}
              onChange={(d) => field.onChange(d)}
              today={today}
              error={errorText(errors.txnDate?.message)}
            />
          )}
        />
        {txnDate > today ? (
          <AppText variant="caption" color="warning" testID="future-hint">
            {strings.txn.countedOn(formatLocalDate(txnDate, 'short'))}
          </AppText>
        ) : null}

        <Controller
          control={control}
          name="paymentMethod"
          render={({ field }) => (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="label" color="textMuted">
                {strings.txn.paymentMethod}
              </AppText>
              <View style={[styles.wrap, { gap: spacing.sm }]} accessibilityRole="radiogroup">
                {PAYMENT_METHODS.map((m) => (
                  <Chip
                    key={m}
                    label={strings.paymentMethod[m]}
                    selected={field.value === m}
                    onPress={() => field.onChange(m)}
                  />
                ))}
              </View>
            </View>
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <TextField
              label={strings.txn.description}
              placeholder={strings.txn.descriptionPlaceholder}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              maxLength={100}
              error={errorText(errors.description?.message)}
            />
          )}
        />

        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <TextField
              label={strings.txn.notes}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              multiline
              maxLength={1000}
              style={{ minHeight: 96, textAlignVertical: 'top' }}
              error={errorText(errors.notes?.message)}
            />
          )}
        />

        {receipts}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            padding: spacing.md,
            gap: spacing.sm,
            borderTopColor: colors.border,
            backgroundColor: colors.bg,
          },
        ]}
      >
        {submitError ? (
          <AppText color="danger" accessibilityLiveRegion="polite">
            {submitError}
          </AppText>
        ) : null}
        <Button label={submitLabel} onPress={submit} loading={isSubmitting} testID="save-button" />
      </View>

      <CategoryFormSheet
        visible={creatingCategory}
        title={strings.categories.newTitle}
        onClose={() => setCreatingCategory(false)}
        onSubmit={async (values) => {
          const created = await onCreateCategory(type, values);
          setExtraCategories((list) => [...list, created]);
          setValue('categoryId', created.id, { shouldDirty: true, shouldValidate: true });
          setCreatingCategory(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
});
