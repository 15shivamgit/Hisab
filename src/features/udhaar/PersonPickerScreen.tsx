// Person picker for the dashboard's "I gave" / "I got" (UDHAAR.md § Person picker).
// With nobody added yet, the Add person form opens directly.

import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { strings } from '@/content/strings';
import { personRepository } from '@/db/repositories/personRepository';
import type { UdhaarDirection } from '@/db/types';
import { PersonRow } from '@/features/udhaar/components/PersonRow';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useDebounced } from '@/hooks/useDebounced';
import { useToday } from '@/hooks/useToday';
import { useTheme } from '@/theme/ThemeProvider';

export function PersonPickerScreen({ direction }: { direction: UdhaarDirection }) {
  const router = useRouter();
  const today = useToday();
  const { colors, spacing, radius, typography } = useTheme();
  const [searchText, setSearchText] = useState('');
  const search = useDebounced(searchText, 300);

  const query = useDbQuery(
    async (db) => ({
      total: await personRepository.count(db),
      people: await personRepository.listWithBalances(db, { search, sort: 'name_asc' }, today),
    }),
    [search, today],
    { tables: ['people', 'udhaar_entries'] },
  );

  const addPerson = () => router.replace({ pathname: '/person/new', params: { then: direction } });
  const noPeople = query.status === 'success' && query.data.total === 0;
  useEffect(() => {
    if (noPeople) router.replace({ pathname: '/person/new', params: { then: direction } });
  }, [noPeople, direction, router]);

  let body;
  if (query.status === 'loading' || noPeople) {
    body = (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
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
  } else {
    body = (
      <FlatList
        data={query.data.people}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.xs }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            <Button label={strings.udhaar.addPerson} variant="secondary" onPress={addPerson} />
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
          </View>
        }
        ListEmptyComponent={<EmptyState title={strings.udhaar.noMatch} />}
        renderItem={({ item }) => (
          <PersonRow
            person={item}
            today={today}
            onPress={() =>
              router.replace({
                pathname: '/udhaar-entry/new',
                params: { personId: item.id, direction },
              })
            }
          />
        )}
      />
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ title: strings.udhaar.pickPerson }} />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
