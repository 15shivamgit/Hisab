// Add / edit person (UDHAAR.md § Add / edit person, UDH-01). No contacts permission.

import { Stack, usePreventRemove, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { FormFooter } from '@/components/FormFooter';
import { KeyboardAvoider } from '@/components/KeyboardAvoider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState } from '@/components/ErrorState';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { strings } from '@/content/strings';
import { personRepository } from '@/db/repositories/personRepository';
import type { UdhaarDirection } from '@/db/types';
import { useDb } from '@/hooks/DatabaseContext';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useDebounced } from '@/hooks/useDebounced';
import { useToday } from '@/hooks/useToday';
import { systemClock } from '@/lib/clock';
import { isAppError } from '@/lib/errors';
import { udhaar } from '@/services/appServices';
import { useTheme } from '@/theme/ThemeProvider';

type Props =
  | {
      mode: 'new';
      /** Came from "I gave/I got": open the entry form after saving. */ then?: UdhaarDirection;
    }
  | { mode: 'edit'; id: string };

interface Values {
  name: string;
  phone: string;
  notes: string;
}

export function PersonFormScreen(props: Props) {
  const db = useDb();
  const router = useRouter();
  const toast = useToast();
  const today = useToday();
  const { colors, spacing } = useTheme();
  const editId = props.mode === 'edit' ? props.id : undefined;

  const loaded = useDbQuery(
    async (client) => {
      if (!editId) return { name: '', phone: '', notes: '' } as Values;
      const p = await personRepository.getWithBalance(client, editId, today);
      return p ? ({ name: p.name, phone: p.phone ?? '', notes: p.notes ?? '' } as Values) : null;
    },
    [editId],
    { tables: [] },
  );

  const [values, setValues] = useState<Values | null>(null);
  const [initial, setInitial] = useState<Values | null>(null);
  // Copy the loaded values into form state once (adjust-during-render, no effect).
  if (loaded.status === 'success' && loaded.data && initial === null) {
    setInitial(loaded.data);
    setValues(loaded.data);
  }

  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [submitError, setSubmitError] = useState<string>();
  const [saving, setSaving] = useState(false);
  /** Where to go once saved; navigating waits a render so the discard guard is off. */
  const [leaveTo, setLeaveTo] = useState<
    | { kind: 'back' }
    | { kind: 'ledger'; personId: string }
    | { kind: 'entry'; personId: string; direction: UdhaarDirection }
    | null
  >(null);
  const [pendingLeave, setPendingLeave] = useState<{ repeat: () => void } | null>(null);

  const dirty =
    values !== null && initial !== null && JSON.stringify(values) !== JSON.stringify(initial);
  usePreventRemove(dirty && !leaveTo, ({ repeat }) => setPendingLeave({ repeat }));

  // Duplicate name: a warning, never an error (names are not unique).
  const name = useDebounced(values?.name.trim() ?? '', 300);
  const duplicate = useDbQuery(
    (client) => (name ? personRepository.sameNameCount(client, name, editId) : Promise.resolve(0)),
    [name, editId],
    { tables: [] },
  );

  useEffect(() => {
    if (!leaveTo) return;
    if (leaveTo.kind === 'back') router.back();
    else if (leaveTo.kind === 'ledger') {
      router.replace({ pathname: '/person/[id]', params: { id: leaveTo.personId } });
    } else {
      router.replace({
        pathname: '/udhaar-entry/new',
        params: { personId: leaveTo.personId, direction: leaveTo.direction },
      });
    }
  }, [leaveTo, router]);

  const set = (key: keyof Values) => (text: string) => {
    setValues((v) => (v ? { ...v, [key]: text } : v));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const save = async () => {
    if (!values) return;
    setSaving(true);
    setSubmitError(undefined);
    try {
      if (editId) {
        await udhaar.updatePerson(db, systemClock, editId, values);
        toast(strings.person.saved);
        setLeaveTo({ kind: 'back' });
      } else {
        const person = await udhaar.createPerson(db, systemClock, values);
        toast(strings.person.saved);
        const then = props.mode === 'new' ? props.then : undefined;
        setLeaveTo(
          then
            ? { kind: 'entry', personId: person.id, direction: then }
            : { kind: 'ledger', personId: person.id },
        );
      }
    } catch (error) {
      const detail = isAppError(error) ? error.detail : undefined;
      const field = detail?.startsWith('person.') ? (detail.slice(7) as keyof Values) : undefined;
      if (field && detail) setErrors({ [field]: strings.person.errors[detail] });
      else setSubmitError(strings.common.somethingWrong);
    } finally {
      setSaving(false);
    }
  };

  let body;
  if (loaded.status === 'loading' || (loaded.status === 'success' && loaded.data && !values)) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  } else if (loaded.status === 'error' || !values) {
    body = (
      <ErrorState
        title={strings.common.loadFailed}
        message={strings.common.somethingWrong}
        onRetry={loaded.status === 'error' ? loaded.reload : undefined}
      />
    );
  } else {
    body = (
      <>
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: spacing.xs }}>
            <TextField
              label={strings.person.name}
              value={values.name}
              onChangeText={set('name')}
              maxLength={60}
              autoFocus={!editId}
              autoCapitalize="words"
              error={errors.name}
            />
            {duplicate.status === 'success' && duplicate.data > 0 && !errors.name ? (
              <AppText variant="caption" color="warning" accessibilityLiveRegion="polite">
                {strings.person.duplicate(name)}
              </AppText>
            ) : null}
          </View>
          <View style={{ gap: spacing.xs }}>
            <TextField
              label={strings.person.phone}
              value={values.phone}
              onChangeText={set('phone')}
              keyboardType="phone-pad"
              maxLength={24}
              error={errors.phone}
            />
            <AppText variant="caption" color="textMuted">
              {strings.person.phoneHint}
            </AppText>
          </View>
          <TextField
            label={strings.person.notes}
            value={values.notes}
            onChangeText={set('notes')}
            multiline
            maxLength={500}
            style={{ minHeight: 96, textAlignVertical: 'top' }}
            error={errors.notes}
          />
        </ScrollView>
        <FormFooter error={submitError}>
          <Button label={strings.person.save} onPress={() => void save()} loading={saving} />
        </FormFooter>
      </>
    );
  }

  return (
    <KeyboardAvoider style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{ title: editId ? strings.person.editTitle : strings.person.newTitle }}
      />
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
          setInitial(values);
          leave?.repeat();
        }}
      />
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
