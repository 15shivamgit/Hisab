import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { strings } from '@/content/strings';
import { addDays, formatLocalDate, localDateToDate, todayLocal, type LocalDate } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';

interface DateFieldProps {
  label: string;
  value: LocalDate;
  onChange: (date: LocalDate) => void;
  today: LocalDate;
  /** Udhaar entries can't be in the future (FR-4.12). */
  maxDate?: LocalDate;
  /** Show "Today" / "Yesterday" shortcut chips. */
  shortcuts?: boolean;
  error?: string;
}

/** Shows "Today"/"Yesterday"/"21 Oct 2026"; tapping opens the Android date picker. */
export function DateField({
  label,
  value,
  onChange,
  today,
  maxDate,
  shortcuts = true,
  error,
}: DateFieldProps) {
  const { colors, radius, spacing } = useTheme();
  const yesterday = addDays(today, -1);
  const shown =
    value === today
      ? strings.txn.today
      : value === yesterday
        ? strings.txn.yesterday
        : formatLocalDate(value, 'long');

  const open = () =>
    DateTimePickerAndroid.open({
      value: localDateToDate(value),
      mode: 'date',
      maximumDate: maxDate ? localDateToDate(maxDate) : undefined,
      onValueChange: (_event, date) => onChange(todayLocal(date)),
    });

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label" color="textMuted">
        {label}
      </AppText>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${shown}`}
        accessibilityHint="Opens the date picker"
        style={[
          styles.field,
          {
            backgroundColor: colors.surfaceAlt,
            borderColor: error ? colors.danger : colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            gap: spacing.sm,
          },
        ]}
      >
        <Icon name="calendar_today" size={20} color={colors.textMuted} />
        <AppText>{shown}</AppText>
      </Pressable>
      {shortcuts ? (
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Chip
            label={strings.txn.today}
            selected={value === today}
            onPress={() => onChange(today)}
          />
          <Chip
            label={strings.txn.yesterday}
            selected={value === yesterday}
            onPress={() => onChange(yesterday)}
          />
        </View>
      ) : null}
      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { minHeight: 48, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row' },
});
