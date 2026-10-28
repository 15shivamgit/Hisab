// Udhaar tab: people with balances (UDHAAR.md § Udhaar tab, UDH-10).

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Fab } from '@/components/Fab';
import { Skeleton } from '@/components/Skeleton';
import { strings } from '@/content/strings';
import { personRepository } from '@/db/repositories/personRepository';
import { udhaarRepository } from '@/db/repositories/udhaarRepository';
import type { PeopleFilter, PeopleSort } from '@/db/types';
import { PersonRow } from '@/features/udhaar/components/PersonRow';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useDebounced } from '@/hooks/useDebounced';
import { useToday } from '@/hooks/useToday';
import { formatPaise } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';

const FILTERS: readonly PeopleFilter[] = ['all', 'will_get', 'owe', 'settled', 'overdue'];
const SORTS: readonly PeopleSort[] = ['amount_desc', 'name_asc', 'recent'];

export function UdhaarScreen() {
  const router = useRouter();
  const today = useToday();
  const { colors, spacing, radius, typography } = useTheme();
  const [searchText, setSearchText] = useState('');
  const search = useDebounced(searchText, 300);
  const [filter, setFilter] = useState<PeopleFilter>('all');
  const [sort, setSort] = useState<PeopleSort>('amount_desc');
  const [showArchived, setShowArchived] = useState(false);

  const query = useDbQuery(
    async (db) => ({
      totals: await udhaarRepository.totals(db),
      total: await personRepository.count(db),
      people: await personRepository.listWithBalances(
        db,
        { search, filter, sort, includeArchived: showArchived },
        today,
      ),
    }),
    [search, filter, sort, showArchived, today],
    { tables: ['people', 'udhaar_entries'] },
  );

  const openPerson = (id: string) => router.push({ pathname: '/person/[id]', params: { id } });
  const addPerson = () => router.push('/person/new');

  let body;
  if (query.status === 'loading') {
    body = (
      <View style={{ gap: spacing.md, padding: spacing.md }}>
        <Skeleton height={64} />
        <Skeleton height={56} />
        <Skeleton height={56} />
      </View>
    );
  } else if (query.status === 'error') {
    body = (
      <ErrorState
        title={strings.common.loadFailed}
        message={strings.common.somethingWrong}
        onRetry={query.reload}
      />
    );
  } else if (query.data.total === 0) {
    body = (
      <EmptyState
        title={strings.udhaar.emptyTitle}
        message={strings.udhaar.emptyMessage}
        action={{ label: strings.udhaar.addPerson, onPress: addPerson }}
      />
    );
  } else {
    const { totals, people } = query.data;
    body = (
      <FlatList
        data={people}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 96, gap: spacing.xs }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            <Card style={[styles.row, { gap: spacing.md }]}>
              <View style={styles.fill}>
                <AppText variant="caption" color="textMuted">
                  {strings.udhaar.willGet}
                </AppText>
                <AppText variant="heading" style={{ color: colors.willGet }}>
                  {formatPaise(totals.youWillGetPaise, { compact: true })}
                </AppText>
              </View>
              <View style={styles.fill}>
                <AppText variant="caption" color="textMuted">
                  {strings.udhaar.owe}
                </AppText>
                <AppText variant="heading" style={{ color: colors.owe }}>
                  {formatPaise(totals.youOwePaise, { compact: true })}
                </AppText>
              </View>
            </Card>
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder={strings.udhaar.searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={strings.udhaar.searchPlaceholder}
              style={[
                typography.body,
                {
                  color: colors.text,
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  minHeight: 48,
                },
              ]}
            />
            <View style={[styles.wrap, { gap: spacing.sm }]} accessibilityRole="radiogroup">
              {FILTERS.map((f) => (
                <Chip
                  key={f}
                  label={strings.udhaar.filters[f]}
                  selected={filter === f}
                  role="radio"
                  onPress={() => setFilter(f)}
                />
              ))}
            </View>
            <View style={[styles.wrap, styles.row, { gap: spacing.sm }]}>
              <AppText variant="caption" color="textMuted">
                {strings.udhaar.sortLabel}
              </AppText>
              {SORTS.map((s) => (
                <Chip
                  key={s}
                  label={strings.udhaar.sort[s]}
                  selected={sort === s}
                  role="radio"
                  onPress={() => setSort(s)}
                />
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ opacity: item.archivedAt ? 0.6 : 1 }}>
            <PersonRow person={item} today={today} onPress={() => openPerson(item.id)} />
          </View>
        )}
        ListEmptyComponent={<EmptyState title={strings.udhaar.noMatch} />}
        ListFooterComponent={
          <Button
            label={showArchived ? strings.udhaar.hideArchived : strings.udhaar.showArchived}
            variant="ghost"
            onPress={() => setShowArchived((v) => !v)}
          />
        }
      />
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.fill}>
      <AppText
        variant="title"
        accessibilityRole="header"
        style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}
      >
        {strings.udhaar.title}
      </AppText>
      {body}
      {query.status === 'success' && query.data.total > 0 ? (
        <Fab onPress={addPerson} accessibilityLabel={strings.udhaar.addPerson} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
