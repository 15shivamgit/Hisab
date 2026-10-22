import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountText } from '@/components/AmountText';
import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Fab } from '@/components/Fab';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { Skeleton } from '@/components/Skeleton';
import { strings } from '@/content/strings';
import { categoryRepository } from '@/db/repositories/categoryRepository';
import { transactionRepository } from '@/db/repositories/transactionRepository';
import type { TxnSort } from '@/db/types';
import { FilterSheet } from '@/features/transactions/components/FilterSheet';
import { TransactionRow } from '@/features/transactions/components/TransactionRow';
import { groupTransactions } from '@/features/transactions/grouping';
import {
  activeFilterCount,
  EMPTY_FILTER,
  periodRange,
  toTxnFilter,
  type ListFilter,
} from '@/features/transactions/listFilter';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useToday } from '@/hooks/useToday';
import { formatLocalDate } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';

const PAGE = 50;
const SORTS: TxnSort[] = ['date_desc', 'date_asc', 'amount_desc', 'amount_asc'];
const TABLES = ['transactions', 'transaction_attachments', 'categories'] as const;

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function TransactionsScreen() {
  const router = useRouter();
  const today = useToday();
  const { colors, radius, spacing, typography } = useTheme();

  const [searchText, setSearchText] = useState('');
  const search = useDebounced(searchText, 300);
  const [filter, setFilter] = useState<ListFilter>(EMPTY_FILTER);
  const [sort, setSort] = useState<TxnSort>('date_desc');
  const [limit, setLimit] = useState(PAGE);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

  const txnFilter = useMemo(
    () => toTxnFilter(filter, today, search, sort),
    [filter, today, search, sort],
  );
  const filterKey = JSON.stringify(txnFilter);

  // New filter/search/sort starts again from the first page.
  const [limitKey, setLimitKey] = useState(filterKey);
  if (limitKey !== filterKey) {
    setLimitKey(filterKey);
    setLimit(PAGE);
  }

  const list = useDbQuery(
    async (db) => {
      // One extra row tells us whether there is another page.
      const rows = await transactionRepository.list(db, txnFilter, { limit: limit + 1, offset: 0 });
      return { items: rows.slice(0, limit), hasMore: rows.length > limit };
    },
    [filterKey, limit],
    { tables: TABLES },
  );
  const summary = useDbQuery(
    (db) => transactionRepository.summary(db, txnFilter, today),
    [filterKey, today],
    {
      tables: TABLES,
    },
  );
  const anyAtAll = useDbQuery(
    async (db) => (await transactionRepository.summary(db, {}, today)).count > 0,
    [today],
    {
      tables: TABLES,
    },
  );
  const categories = useDbQuery(
    (db) => categoryRepository.list(db, { includeArchived: true }),
    [],
    {
      tables: ['categories'],
    },
  );

  const entries = useMemo(
    () => (list.status === 'success' ? groupTransactions(list.data.items, today, sort) : []),
    [list.status, list.data, today, sort],
  );

  const filtering = activeFilterCount(filter) > 0 || search.trim() !== '';
  const categoryName = (id: string) => categories.data?.find((c) => c.id === id)?.name ?? '';
  const range = periodRange(filter, today);

  const removable: { key: string; label: string; remove: () => void }[] = [
    ...(filter.type
      ? [
          {
            key: 'type',
            label: strings.txnType[filter.type],
            remove: () => setFilter((f) => ({ ...f, type: undefined })),
          },
        ]
      : []),
    ...filter.categoryIds.map((id) => ({
      key: `c:${id}`,
      label: categoryName(id),
      remove: () =>
        setFilter((f) => ({ ...f, categoryIds: f.categoryIds.filter((x) => x !== id) })),
    })),
    ...filter.paymentMethods.map((m) => ({
      key: `m:${m}`,
      label: strings.paymentMethod[m],
      remove: () =>
        setFilter((f) => ({ ...f, paymentMethods: f.paymentMethods.filter((x) => x !== m) })),
    })),
    ...(filter.period !== 'all' && range
      ? [
          {
            key: 'period',
            label:
              filter.period === 'custom'
                ? `${formatLocalDate(range.start, 'short')} – ${formatLocalDate(range.end, 'short')}`
                : filter.period === 'this_month'
                  ? strings.list.thisMonth
                  : strings.list.lastMonth,
            remove: () => setFilter((f) => ({ ...f, period: 'all', custom: undefined })),
          },
        ]
      : []),
  ];

  const header = (
    <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
      <AppText variant="title" accessibilityRole="header">
        {strings.tab.transactions}
      </AppText>
      <View
        style={[
          styles.search,
          {
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            gap: spacing.sm,
          },
        ]}
      >
        <Icon name="search" size={20} color={colors.textMuted} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder={strings.list.searchPlaceholder}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={strings.list.searchPlaceholder}
          returnKeyType="search"
          style={[styles.fill, typography.body, { color: colors.text, minHeight: 48 }]}
        />
        {searchText ? (
          <Pressable
            onPress={() => setSearchText('')}
            accessibilityLabel={strings.common.close}
            hitSlop={12}
          >
            <Icon name="close" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Chip
          role="button"
          label={
            activeFilterCount(filter) > 0
              ? `${strings.list.filters} (${activeFilterCount(filter)})`
              : strings.list.filters
          }
          icon={<Icon name="filter_list" size={20} color={colors.text} />}
          onPress={() => setShowFilters(true)}
        />
        <Chip
          role="button"
          label={strings.list.sortOptions[sort]}
          icon={<Icon name="sort" size={20} color={colors.text} />}
          onPress={() => setShowSort(true)}
          accessibilityLabel={`${strings.list.sort}: ${strings.list.sortOptions[sort]}`}
        />
      </View>
      {removable.length ? (
        <View style={[styles.wrap, { gap: spacing.sm }]}>
          {removable.map((r) => (
            <Chip
              key={r.key}
              role="button"
              label={r.label}
              selected
              icon={<Icon name="close" size={16} color={colors.primary} />}
              accessibilityLabel={`Remove filter ${r.label}`}
              onPress={r.remove}
            />
          ))}
          <Chip
            role="button"
            label={strings.list.clearAll}
            onPress={() => setFilter(EMPTY_FILTER)}
          />
        </View>
      ) : null}
      {summary.status === 'success' && summary.data.count > 0 ? (
        <View style={[styles.row, styles.between, { paddingVertical: spacing.xs }]}>
          <AppText variant="caption" color="textMuted">
            {strings.list.summary(summary.data.count)}
          </AppText>
          <View style={[styles.row, { gap: spacing.md }]}>
            <AmountText paise={summary.data.incomePaise} kind="income" variant="caption" compact />
            <AmountText
              paise={summary.data.expensePaise}
              kind="expense"
              variant="caption"
              compact
            />
          </View>
        </View>
      ) : null}
    </View>
  );

  let content;
  if (list.status === 'loading') {
    content = (
      <View style={{ gap: spacing.md, paddingTop: spacing.md }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.row, { gap: spacing.md }]}>
            <Skeleton width={40} height={40} />
            <View style={[styles.fill, { gap: spacing.xs }]}>
              <Skeleton width="60%" />
              <Skeleton width="40%" height={12} />
            </View>
          </View>
        ))}
      </View>
    );
  } else if (list.status === 'error') {
    content = (
      <ErrorState
        title={strings.common.loadFailed}
        message={strings.common.somethingWrong}
        onRetry={list.reload}
      />
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.fill, { backgroundColor: colors.bg }]}
    >
      {content ? (
        <View style={[styles.fill, { padding: spacing.md }]}>
          {header}
          {content}
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.key}
          ListHeaderComponent={header}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 96, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (list.status === 'success' && list.data.hasMore) setLimit((l) => l + PAGE);
          }}
          ListEmptyComponent={
            filtering || anyAtAll.data ? (
              <EmptyState
                title={strings.list.noMatchTitle}
                message={strings.list.noMatchMessage}
                action={{
                  label: strings.list.clearAll,
                  onPress: () => {
                    setFilter(EMPTY_FILTER);
                    setSearchText('');
                  },
                }}
              />
            ) : (
              <EmptyState
                title={strings.list.emptyTitle}
                message={strings.list.emptyMessage}
                action={{
                  label: strings.list.emptyAction,
                  onPress: () =>
                    router.push({ pathname: '/transaction/new', params: { type: 'expense' } }),
                }}
              />
            )
          }
          ListFooterComponent={
            list.status === 'success' && list.data.hasMore ? (
              <ActivityIndicator color={colors.primary} style={{ margin: spacing.md }} />
            ) : undefined
          }
          renderItem={({ item: entry }) =>
            entry.kind === 'header' ? (
              <View
                style={[
                  styles.row,
                  styles.between,
                  { paddingTop: spacing.md, paddingBottom: spacing.xs },
                ]}
                accessibilityRole="header"
              >
                <AppText variant="label" color="textMuted">
                  {entry.date === 'upcoming'
                    ? strings.txn.upcoming
                    : formatLocalDate(entry.date, 'list', today)}
                </AppText>
                {entry.date !== 'upcoming' ? (
                  <AmountText paise={entry.netPaise} kind="net" variant="caption" compact />
                ) : null}
              </View>
            ) : (
              <TransactionRow
                item={entry.item}
                upcoming={entry.upcoming}
                onPress={() =>
                  router.push({ pathname: '/transaction/[id]', params: { id: entry.item.id } })
                }
              />
            )
          }
        />
      )}

      <Fab
        accessibilityLabel={strings.txn.newExpense}
        onPress={() => router.push({ pathname: '/transaction/new', params: { type: 'expense' } })}
      />

      <FilterSheet
        visible={showFilters}
        value={filter}
        categories={categories.data ?? []}
        today={today}
        onClose={() => setShowFilters(false)}
        onApply={(next) => {
          setFilter(next);
          setShowFilters(false);
        }}
      />
      <Sheet visible={showSort} title={strings.list.sort} onClose={() => setShowSort(false)}>
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          {SORTS.map((s) => (
            <Chip
              key={s}
              label={strings.list.sortOptions[s]}
              selected={s === sort}
              onPress={() => {
                setSort(s);
                setShowSort(false);
              }}
            />
          ))}
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  between: { justifyContent: 'space-between' },
  search: { flexDirection: 'row', alignItems: 'center' },
});
