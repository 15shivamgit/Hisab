// Person ledger (UDHAAR.md § Person ledger; UDH-03, UDH-04, UDH-07, UDH-11).

import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Icon } from '@/components/Icon';
import { ListRow } from '@/components/ListRow';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { strings } from '@/content/strings';
import { personRepository } from '@/db/repositories/personRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { udhaarRepository } from '@/db/repositories/udhaarRepository';
import type { UdhaarDirection, UdhaarEntryWithBalance } from '@/db/types';
import { BalanceText, balanceWords } from '@/features/udhaar/components/BalanceText';
import { RemindSheet } from '@/features/udhaar/components/RemindSheet';
import { returnByChip } from '@/features/udhaar/dueText';
import { useDb } from '@/hooks/DatabaseContext';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useToday } from '@/hooks/useToday';
import { systemClock } from '@/lib/clock';
import { formatLocalDate, localDateToDate, todayLocal } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { reminders, udhaar } from '@/services/appServices';
import { diagnostics } from '@/services/diagnostics';
import { useTheme } from '@/theme/ThemeProvider';

export function PersonLedgerScreen({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const toast = useToast();
  const today = useToday();
  const { colors, spacing } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notificationsOff, setNotificationsOff] = useState(false);

  const query = useDbQuery(
    async (client) => ({
      person: await personRepository.getWithBalance(client, id, today),
      entries: await udhaarRepository.listByPerson(client, id),
    }),
    [id, today],
    { tables: ['people', 'udhaar_entries'] },
  );

  if (query.status !== 'success' || !query.data.person) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Stack.Screen options={{ title: strings.udhaar.title }} />
        {query.status === 'loading' ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : (
          <ErrorState
            title={strings.common.loadFailed}
            message={query.status === 'error' ? strings.common.somethingWrong : ''}
            onRetry={query.status === 'error' ? query.reload : undefined}
          />
        )}
      </View>
    );
  }

  const { person, entries } = query.data;
  const settled = person.balancePaise === 0;

  const run = async (task: () => Promise<unknown>, done?: string) => {
    try {
      await task();
      if (done) toast(done);
    } catch (error) {
      void diagnostics.record(error, 'udhaar.ledger');
      toast(strings.common.somethingWrong);
    }
  };

  /** UDH-07: pick a date from today; ask for notifications the first time (UDH-08). */
  const pickReturnDate = () =>
    DateTimePickerAndroid.open({
      value: localDateToDate(
        person.returnByDate && person.returnByDate >= today ? person.returnByDate : today,
      ),
      mode: 'date',
      minimumDate: localDateToDate(today),
      onValueChange: (_event, date) => {
        const chosen = todayLocal(date);
        void run(async () => {
          if (await settingsRepository.get(db, 'reminders_enabled')) {
            if ((await reminders.ensurePermission()) !== 'granted') setNotificationsOff(true);
          }
          await udhaar.setReturnByDate(db, systemClock, person.id, chosen);
        }, strings.returnBy.saved);
      },
    });

  const addEntry = (direction: UdhaarDirection) =>
    router.push({ pathname: '/udhaar-entry/new', params: { personId: person.id, direction } });

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
      <Card style={{ gap: spacing.sm }}>
        <AppText variant="title">{person.name}</AppText>
        <BalanceText balancePaise={person.balancePaise} variant="heading" />
        {person.archivedAt ? (
          <AppText variant="caption" color="textMuted">
            {strings.udhaar.archived}
          </AppText>
        ) : null}
        <View style={styles.row}>
          <Chip
            label={returnByChip(person)}
            role="button"
            onPress={pickReturnDate}
            icon={
              <Icon
                name="event"
                size={18}
                color={person.isOverdue ? colors.danger : colors.primary}
              />
            }
          />
        </View>
      </Card>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <View style={styles.fill}>
          <Button label={strings.quick.gave} onPress={() => addEntry('gave')} />
        </View>
        <View style={styles.fill}>
          <Button label={strings.quick.got} variant="secondary" onPress={() => addEntry('got')} />
        </View>
      </View>
      {!settled ? (
        <Button label={strings.udhaar.remind} variant="ghost" onPress={() => setRemindOpen(true)} />
      ) : null}
    </View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          title: person.name,
          headerRight: () => (
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={strings.udhaar.options}
              hitSlop={12}
            >
              <Icon name="more_vert" color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        ListEmptyComponent={
          <EmptyState
            title={strings.udhaar.ledgerEmptyTitle(person.name)}
            message={strings.udhaar.ledgerEmptyMessage}
          />
        }
        renderItem={({ item }) => (
          <EntryRow
            entry={item}
            onPress={() =>
              router.push({ pathname: '/udhaar-entry/[id]/edit', params: { id: item.id } })
            }
          />
        )}
      />

      <Sheet visible={menuOpen} title={person.name} onClose={() => setMenuOpen(false)}>
        <View>
          <ListRow
            title={strings.udhaar.menu.edit}
            left={<Icon name="edit" color={colors.primary} />}
            onPress={() => {
              setMenuOpen(false);
              router.push({ pathname: '/person/[id]/edit', params: { id: person.id } });
            }}
          />
          {person.returnByDate ? (
            <ListRow
              title={strings.udhaar.clearReturnDate}
              left={<Icon name="event_busy" color={colors.primary} />}
              onPress={() => {
                setMenuOpen(false);
                void run(() => udhaar.setReturnByDate(db, systemClock, person.id, null));
              }}
            />
          ) : null}
          {person.archivedAt ? (
            <ListRow
              title={strings.udhaar.menu.unarchive}
              left={<Icon name="unarchive" color={colors.primary} />}
              onPress={() => {
                setMenuOpen(false);
                void run(
                  () => udhaar.setArchived(db, systemClock, person.id, false),
                  strings.udhaar.personUnarchived,
                );
              }}
            />
          ) : (
            <ListRow
              title={strings.udhaar.menu.archive}
              subtitle={settled ? undefined : strings.udhaar.archiveOnlySettled}
              left={<Icon name="archive" color={settled ? colors.primary : colors.textMuted} />}
              onPress={
                settled
                  ? () => {
                      setMenuOpen(false);
                      void run(async () => {
                        await udhaar.setArchived(db, systemClock, person.id, true);
                        router.back();
                      }, strings.udhaar.personArchived);
                    }
                  : undefined
              }
            />
          )}
          <ListRow
            title={strings.udhaar.menu.delete}
            subtitle={person.entryCount > 0 ? strings.udhaar.deleteOnlyEmpty : undefined}
            left={
              <Icon
                name="delete"
                color={person.entryCount > 0 ? colors.textMuted : colors.danger}
              />
            }
            onPress={
              person.entryCount === 0
                ? () => {
                    setMenuOpen(false);
                    setConfirmDelete(true);
                  }
                : undefined
            }
          />
        </View>
      </Sheet>

      <RemindSheet person={person} visible={remindOpen} onClose={() => setRemindOpen(false)} />

      <ConfirmDialog
        visible={confirmDelete}
        title={strings.udhaar.deletePersonTitle(person.name)}
        body={strings.udhaar.deletePersonBody}
        confirmLabel={strings.common.delete}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void run(async () => {
            await udhaar.deletePerson(db, systemClock, person.id);
            router.back();
          }, strings.udhaar.personDeleted);
        }}
      />
      <ConfirmDialog
        visible={notificationsOff}
        title={strings.returnBy.title}
        body={strings.returnBy.notificationsOff}
        confirmLabel={strings.returnBy.openSettings}
        cancelLabel={strings.common.close}
        onCancel={() => setNotificationsOff(false)}
        onConfirm={() => {
          setNotificationsOff(false);
          void Linking.openSettings();
        }}
      />
    </View>
  );
}

function EntryRow({ entry, onPress }: { entry: UdhaarEntryWithBalance; onPress: () => void }) {
  const { colors, spacing } = useTheme();
  const gave = entry.direction === 'gave';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${gave ? strings.udhaar.gaveRow : strings.udhaar.gotRow} ${formatPaise(entry.amountPaise, { compact: true })}, ${formatLocalDate(entry.entryDate, 'long')}`}
      style={({ pressed }) => [
        styles.entry,
        {
          gap: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.fill}>
        <AppText variant="bodyStrong">
          {`${gave ? strings.udhaar.gaveRow : strings.udhaar.gotRow} ${formatPaise(entry.amountPaise, { compact: true })}`}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {`${formatLocalDate(entry.entryDate, 'long')} · ${strings.paymentMethod[entry.paymentMethod]}`}
        </AppText>
        {entry.note ? (
          <AppText variant="caption" numberOfLines={2}>
            {entry.note}
          </AppText>
        ) : null}
      </View>
      <AppText variant="caption" color="textMuted" style={styles.after}>
        {balanceWords(entry.balanceAfterPaise)}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  after: { maxWidth: '40%', textAlign: 'right' },
});
