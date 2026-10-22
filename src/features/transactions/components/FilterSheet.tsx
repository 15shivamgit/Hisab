import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Chip } from '@/components/Chip';
import { DateField } from '@/components/DateField';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Sheet } from '@/components/Sheet';
import { strings } from '@/content/strings';
import { PAYMENT_METHODS, type Category, type TxnType } from '@/db/types';
import { EMPTY_FILTER, type ListFilter, type ListPeriod } from '@/features/transactions/listFilter';
import { monthRange, type LocalDate } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';

interface FilterSheetProps {
  visible: boolean;
  value: ListFilter;
  categories: readonly Category[];
  today: LocalDate;
  onApply: (filter: ListFilter) => void;
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { value: 'all', label: strings.list.all },
  { value: 'expense', label: strings.txnType.expense },
  { value: 'income', label: strings.txnType.income },
] as const;

const PERIODS: { value: ListPeriod; label: string }[] = [
  { value: 'all', label: strings.list.all },
  { value: 'this_month', label: strings.list.thisMonth },
  { value: 'last_month', label: strings.list.lastMonth },
  { value: 'custom', label: strings.list.custom },
];

function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function FilterSheet({
  visible,
  value,
  categories,
  today,
  onApply,
  onClose,
}: FilterSheetProps) {
  const { spacing } = useTheme();
  const [draft, setDraft] = useState<ListFilter>(value);
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(value);
  }

  // Expense categories first, then income; when both types show, a name that exists in
  // both (e.g. "Other") gets its type so the chips can be told apart.
  const shownCategories = categories
    .filter(
      (c) =>
        (!draft.type || c.type === draft.type) &&
        (c.archivedAt === null || draft.categoryIds.includes(c.id)),
    )
    .sort((a, b) => (a.type === b.type ? 0 : a.type === 'expense' ? -1 : 1));
  const nameCounts = new Map<string, number>();
  for (const c of shownCategories) nameCounts.set(c.name, (nameCounts.get(c.name) ?? 0) + 1);
  const chipLabel = (c: Category) =>
    (nameCounts.get(c.name) ?? 0) > 1 ? `${c.name} · ${strings.txnType[c.type]}` : c.name;
  const custom = draft.custom ?? monthRange(today);
  const customInvalid = draft.period === 'custom' && custom.start > custom.end;

  return (
    <Sheet
      visible={visible}
      title={strings.list.filters}
      onClose={onClose}
      footer={
        <View style={[styles.row, { gap: spacing.sm }]}>
          <View style={styles.fill}>
            <Button
              label={strings.list.reset}
              variant="secondary"
              onPress={() => setDraft(EMPTY_FILTER)}
            />
          </View>
          <View style={styles.fill}>
            <Button
              label={strings.list.apply}
              disabled={customInvalid}
              onPress={() =>
                onApply(
                  draft.period === 'custom'
                    ? { ...draft, custom }
                    : { ...draft, custom: undefined },
                )
              }
            />
          </View>
        </View>
      }
    >
      <SegmentedControl
        options={TYPE_OPTIONS}
        value={draft.type ?? 'all'}
        accessibilityLabel={strings.txn.type}
        onChange={(v) => {
          const type = v === 'all' ? undefined : (v as TxnType);
          setDraft((d) => ({
            ...d,
            type,
            // Drop selected categories of the other type.
            categoryIds: type
              ? d.categoryIds.filter((id) => categories.find((c) => c.id === id)?.type === type)
              : d.categoryIds,
          }));
        }}
      />

      <AppText variant="label" color="textMuted">
        {strings.txn.category}
      </AppText>
      <View style={[styles.wrap, { gap: spacing.sm }]}>
        {shownCategories.map((c) => (
          <Chip
            key={c.id}
            role="checkbox"
            label={chipLabel(c)}
            selected={draft.categoryIds.includes(c.id)}
            icon={<CategoryIcon icon={c.icon} color={c.color} size={24} />}
            onPress={() => setDraft((d) => ({ ...d, categoryIds: toggle(d.categoryIds, c.id) }))}
          />
        ))}
      </View>

      <AppText variant="label" color="textMuted">
        {strings.txn.paymentMethod}
      </AppText>
      <View style={[styles.wrap, { gap: spacing.sm }]}>
        {PAYMENT_METHODS.map((m) => (
          <Chip
            key={m}
            role="checkbox"
            label={strings.paymentMethod[m]}
            selected={draft.paymentMethods.includes(m)}
            onPress={() => setDraft((d) => ({ ...d, paymentMethods: toggle(d.paymentMethods, m) }))}
          />
        ))}
      </View>

      <AppText variant="label" color="textMuted">
        {strings.txn.date}
      </AppText>
      <View style={[styles.wrap, { gap: spacing.sm }]}>
        {PERIODS.map((p) => (
          <Chip
            key={p.value}
            label={p.label}
            selected={draft.period === p.value}
            onPress={() => setDraft((d) => ({ ...d, period: p.value }))}
          />
        ))}
      </View>
      {draft.period === 'custom' ? (
        <View style={{ gap: spacing.md }}>
          <DateField
            label={strings.list.from}
            value={custom.start}
            today={today}
            shortcuts={false}
            onChange={(start) => setDraft((d) => ({ ...d, custom: { ...custom, start } }))}
          />
          <DateField
            label={strings.list.to}
            value={custom.end}
            today={today}
            shortcuts={false}
            error={customInvalid ? strings.errors['date.invalid'] : undefined}
            onChange={(end) => setDraft((d) => ({ ...d, custom: { ...custom, end } }))}
          />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { flexDirection: 'row' },
  fill: { flex: 1 },
});
