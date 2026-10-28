import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { strings } from '@/content/strings';
import type { PersonWithBalance } from '@/db/types';
import { BalanceText, balanceWords } from '@/features/udhaar/components/BalanceText';
import { initials, listBadge } from '@/features/udhaar/dueText';
import { formatLocalDate, type LocalDate } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';

/** People list / picker row (UDHAAR.md § Udhaar tab). */
export function PersonRow({
  person,
  today,
  onPress,
  badgeText,
}: {
  person: PersonWithBalance;
  today: LocalDate;
  onPress: () => void;
  /** Replaces the list badge text (the dashboard says "Due in 3 days"). */
  badgeText?: string | null;
}) {
  const { colors, spacing, radius } = useTheme();
  const listed = listBadge(person);
  const badge = listed && badgeText ? { ...listed, text: badgeText } : listed;
  const badgeColor =
    badge?.tone === 'danger'
      ? colors.danger
      : badge?.tone === 'warning'
        ? colors.warning
        : colors.textMuted;
  const subtitle = person.lastEntryDate
    ? strings.udhaar.lastEntry(formatLocalDate(person.lastEntryDate, 'list', today))
    : strings.udhaar.noEntriesYet;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${person.name}, ${balanceWords(person.balancePaise)}${badge ? `, ${badge.text}` : ''}`}
      style={({ pressed }) => [
        styles.row,
        { gap: spacing.md, paddingVertical: spacing.sm, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View
        style={[styles.avatar, { backgroundColor: colors.primarySoft, borderRadius: radius.lg }]}
      >
        <AppText variant="bodyStrong" style={{ color: colors.primary }}>
          {initials(person.name)}
        </AppText>
      </View>
      <View style={styles.text}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {person.name}
        </AppText>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {subtitle}
        </AppText>
        {badge ? (
          <AppText variant="caption" style={{ color: badgeColor }}>
            {badge.text}
          </AppText>
        ) : null}
      </View>
      <BalanceText balancePaise={person.balancePaise} stacked />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  avatar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
});
