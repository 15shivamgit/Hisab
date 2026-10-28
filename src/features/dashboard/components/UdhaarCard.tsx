// Dashboard udhaar card (DASH-05, DASH-06). Hidden until the user has a person.

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { strings } from '@/content/strings';
import type { PersonWithBalance, UdhaarTotals } from '@/db/types';
import { PersonRow } from '@/features/udhaar/components/PersonRow';
import { dashboardBadge } from '@/features/udhaar/dueText';
import type { LocalDate } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';

function Total({
  label,
  paise,
  sub,
  color,
  icon,
}: {
  label: string;
  paise: number;
  sub: string;
  color: string;
  icon: string;
}) {
  const amount = formatPaise(paise, { compact: true });
  return (
    <View style={styles.fill} accessible accessibilityLabel={`${label} ${amount}, ${sub}`}>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <View style={[styles.row, { gap: 2 }]}>
        <AppText variant="heading" style={{ color }}>
          {amount}
        </AppText>
        <Icon name={icon} size={18} color={color} />
      </View>
      <AppText variant="caption" color="textMuted">
        {sub}
      </AppText>
    </View>
  );
}

export function UdhaarCard({
  totals,
  attention,
  today,
}: {
  totals: UdhaarTotals;
  attention: readonly PersonWithBalance[];
  today: LocalDate;
}) {
  const router = useRouter();
  const { colors, spacing } = useTheme();

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={[styles.row, styles.between]}>
        <AppText variant="heading">{strings.dash.udhaarTitle}</AppText>
        <Button
          label={strings.common.seeAll}
          variant="ghost"
          onPress={() => router.navigate('/udhaar')}
        />
      </View>
      <View style={[styles.row, { gap: spacing.md }]}>
        <Total
          label={strings.udhaar.willGet}
          paise={totals.youWillGetPaise}
          sub={strings.dash.willGetFrom(totals.willGetCount)}
          color={colors.willGet}
          icon="arrow_downward"
        />
        <Total
          label={strings.udhaar.owe}
          paise={totals.youOwePaise}
          sub={strings.dash.oweTo(totals.oweCount)}
          color={colors.owe}
          icon="arrow_upward"
        />
      </View>
      {attention.map((p) => (
        <PersonRow
          key={p.id}
          person={p}
          today={today}
          badgeText={dashboardBadge(p, today)}
          onPress={() => router.push({ pathname: '/person/[id]', params: { id: p.id } })}
        />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { justifyContent: 'space-between' },
});
