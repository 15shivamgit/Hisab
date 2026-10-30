// Add / edit an udhaar entry (UDHAAR.md § Add / edit entry; UDH-02, UDH-05, UDH-06; FR-4.6,
// FR-4.11, FR-4.12).

import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, usePreventRemove, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { FormFooter } from '@/components/FormFooter';
import { KeyboardAvoider } from '@/components/KeyboardAvoider';
import { AmountInput } from '@/components/AmountInput';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DateField } from '@/components/DateField';
import { ErrorState } from '@/components/ErrorState';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { errorText, strings } from '@/content/strings';
import { personRepository } from '@/db/repositories/personRepository';
import { udhaarRepository } from '@/db/repositories/udhaarRepository';
import { PAYMENT_METHODS, type PersonWithBalance, type UdhaarDirection } from '@/db/types';
import { balanceWords } from '@/features/udhaar/components/BalanceText';
import {
  emptyEntryValues,
  entryToFormValues,
  toNewEntry,
  udhaarEntrySchema,
  type UdhaarEntryFormValues,
} from '@/features/udhaar/schema';
import { useDb } from '@/hooks/DatabaseContext';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useToday } from '@/hooks/useToday';
import { signedAmount, wouldFlip } from '@/lib/balance';
import { systemClock } from '@/lib/clock';
import type { LocalDate } from '@/lib/dates';
import { isAppError } from '@/lib/errors';
import { formatPaise, parseRupeesToPaise, type Paise } from '@/lib/money';
import { udhaar } from '@/services/appServices';
import { useTheme } from '@/theme/ThemeProvider';

type Props =
  { mode: 'new'; personId: string; direction: UdhaarDirection } | { mode: 'edit'; id: string };

const DIRECTIONS = [
  { value: 'gave', label: strings.udhaarEntry.gave },
  { value: 'got', label: strings.udhaarEntry.got },
] as const;

export function UdhaarEntryScreen(props: Props) {
  const today = useToday();
  const { colors } = useTheme();
  const editId = props.mode === 'edit' ? props.id : undefined;
  const newPersonId = props.mode === 'new' ? props.personId : undefined;
  const newDirection = props.mode === 'new' ? props.direction : 'gave';

  // Loaded once; the form keeps its own state after that.
  const data = useDbQuery(
    async (client) => {
      const entry = editId ? await udhaarRepository.getById(client, editId) : null;
      const personId = entry?.personId ?? newPersonId;
      const person = personId
        ? await personRepository.getWithBalance(client, personId, today)
        : null;
      if (!person || (editId && !entry)) return null;
      return {
        person,
        // Balance without the entry being edited, so it isn't counted twice.
        before: await udhaarRepository.balanceOf(client, person.id, editId),
        initialValues: entry ? entryToFormValues(entry) : emptyEntryValues(newDirection, today),
      };
    },
    [editId, newPersonId],
    { tables: [] },
  );

  let body;
  if (data.status === 'loading') {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  } else if (data.status === 'error' || !data.data) {
    body = (
      <ErrorState
        title={strings.common.loadFailed}
        message={data.status === 'error' ? strings.common.somethingWrong : ''}
        onRetry={data.status === 'error' ? data.reload : undefined}
      />
    );
  } else {
    body = <EntryForm {...data.data} editId={editId} today={today} />;
  }

  const title = editId
    ? strings.udhaarEntry.editTitle
    : newDirection === 'got'
      ? strings.udhaarEntry.newGot
      : strings.udhaarEntry.newGave;
  return (
    <KeyboardAvoider style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ title }} />
      {body}
    </KeyboardAvoider>
  );
}

function EntryForm({
  person,
  before,
  initialValues,
  editId,
  today,
}: {
  person: PersonWithBalance;
  before: Paise;
  initialValues: UdhaarEntryFormValues;
  editId: string | undefined;
  today: LocalDate;
}) {
  const db = useDb();
  const router = useRouter();
  const toast = useToast();
  const { spacing } = useTheme();
  const [submitError, setSubmitError] = useState<string>();
  const [flipFor, setFlipFor] = useState<UdhaarEntryFormValues | null>(null);
  const [settled, setSettled] = useState<PersonWithBalance | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<{ repeat: () => void } | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UdhaarEntryFormValues>({
    defaultValues: initialValues,
    resolver: zodResolver(udhaarEntrySchema(today)),
  });

  usePreventRemove(isDirty && !leaving, ({ repeat }) => setPendingLeave({ repeat }));
  useEffect(() => {
    if (leaving) router.back();
  }, [leaving, router]);

  // Live preview under the amount (FR-4.6).
  const direction = useWatch({ control, name: 'direction' });
  const amountText = useWatch({ control, name: 'amountText' });
  const parsed = parseRupeesToPaise(amountText);
  const draft = parsed.ok ? { direction, amountPaise: parsed.value } : null;
  const after = draft ? before + signedAmount(draft) : null;

  /** After a save or delete: offer to clear the return date once settled (FR-4.11). */
  const finish = (p: PersonWithBalance | null, message: string) => {
    toast(message);
    if (p && p.balancePaise === 0 && p.returnByDate) setSettled(p);
    else setLeaving(true);
  };

  const save = async (values: UdhaarEntryFormValues) => {
    setBusy(true);
    setSubmitError(undefined);
    try {
      const input = toNewEntry(person.id, values);
      const result = editId
        ? await udhaar.updateEntry(db, systemClock, editId, input)
        : await udhaar.addEntry(db, systemClock, input);
      finish(result.person, editId ? strings.udhaarEntry.updated : strings.udhaarEntry.saved);
    } catch (error) {
      setSubmitError(
        isAppError(error) && error.detail === 'date.future.udhaar'
          ? strings.errors['date.future.udhaar']
          : strings.common.somethingWrong,
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = handleSubmit(async (values) => {
    const amount = parseRupeesToPaise(values.amountText);
    if (
      amount.ok &&
      wouldFlip(before, { direction: values.direction, amountPaise: amount.value })
    ) {
      setFlipFor(values);
      return;
    }
    await save(values);
  });

  const remove = async () => {
    if (!editId) return;
    setBusy(true);
    try {
      const result = await udhaar.deleteEntry(db, systemClock, editId);
      setConfirmDelete(false);
      finish(result.person, strings.udhaarEntry.deleted);
    } catch {
      setConfirmDelete(false);
      setSubmitError(strings.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  };

  const initialAmount = parseRupeesToPaise(initialValues.amountText);

  return (
    <View style={styles.fill}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="heading">{person.name}</AppText>
        <Controller
          control={control}
          name="direction"
          render={({ field }) => (
            <SegmentedControl
              options={DIRECTIONS}
              value={field.value}
              onChange={field.onChange}
              accessibilityLabel={strings.udhaarEntry.direction}
            />
          )}
        />
        <View style={{ gap: spacing.xs }}>
          <Controller
            control={control}
            name="amountText"
            render={({ field }) => (
              <AmountInput
                label={strings.udhaarEntry.amount}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errorText(errors.amountText?.message)}
                autoFocus={initialValues.amountText === ''}
              />
            )}
          />
          {after !== null ? (
            <AppText color="textMuted" accessibilityLiveRegion="polite" testID="balance-preview">
              {strings.udhaarEntry.afterThis(balanceWords(after))}
            </AppText>
          ) : null}
        </View>
        <Controller
          control={control}
          name="entryDate"
          render={({ field }) => (
            <DateField
              label={strings.udhaarEntry.date}
              value={field.value}
              onChange={field.onChange}
              today={today}
              maxDate={today}
              error={errorText(errors.entryDate?.message)}
            />
          )}
        />
        <Controller
          control={control}
          name="paymentMethod"
          render={({ field }) => (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="label" color="textMuted">
                {strings.udhaarEntry.paymentMethod}
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
          name="note"
          render={({ field }) => (
            <TextField
              label={strings.udhaarEntry.note}
              placeholder={strings.udhaarEntry.notePlaceholder}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              multiline
              maxLength={500}
              style={{ minHeight: 72, textAlignVertical: 'top' }}
              error={errorText(errors.note?.message)}
            />
          )}
        />
        <AppText variant="caption" color="textMuted">
          {strings.udhaar.notUdhaarNote}
        </AppText>
        {editId ? (
          <Button
            label={strings.common.delete}
            variant="ghost"
            onPress={() => setConfirmDelete(true)}
            disabled={busy}
          />
        ) : null}
      </ScrollView>

      <FormFooter error={submitError}>
        <Button
          label={strings.common.save}
          onPress={() => void submit()}
          loading={busy}
          testID="save-button"
        />
      </FormFooter>

      <ConfirmDialog
        visible={flipFor !== null}
        title={strings.udhaarEntry.flipTitle}
        body={
          flipFor && draft
            ? strings.udhaarEntry.flipBody(
                person.name,
                balanceWords(before),
                balanceWords(before + signedAmount(draft)),
              )
            : ''
        }
        confirmLabel={strings.udhaarEntry.flipConfirm}
        cancelLabel={strings.udhaarEntry.flipChange}
        busy={busy}
        onCancel={() => setFlipFor(null)}
        onConfirm={() => {
          const values = flipFor;
          setFlipFor(null);
          if (values) void save(values);
        }}
      />
      <ConfirmDialog
        visible={confirmDelete}
        title={strings.udhaarEntry.deleteTitle}
        body={strings.udhaarEntry.deleteBody(
          initialAmount.ok ? formatPaise(initialAmount.value, { compact: true }) : '',
          person.name,
          balanceWords(before),
        )}
        confirmLabel={strings.common.delete}
        danger
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
      />
      <ConfirmDialog
        visible={settled !== null}
        title={strings.udhaarEntry.settledTitle(person.name)}
        body={strings.udhaarEntry.settledBody}
        confirmLabel={strings.udhaarEntry.settledRemove}
        cancelLabel={strings.udhaarEntry.settledKeep}
        onCancel={() => {
          setSettled(null);
          setLeaving(true);
        }}
        onConfirm={() => {
          setSettled(null);
          void udhaar
            .setReturnByDate(db, systemClock, person.id, null)
            .catch(() => toast(strings.common.somethingWrong))
            .finally(() => setLeaving(true));
        }}
      />
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
          leave?.repeat();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
