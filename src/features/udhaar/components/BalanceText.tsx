// Udhaar balance in words + icon + colour, never a bare signed number
// (UI_UX_GUIDE.md § Principles 3): "You will get ₹7,000 ↓", "You owe ₹6,000 ↑", "Settled ✓".

import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { strings } from '@/content/strings';
import type { BalanceLabel } from '@/db/types';
import { balanceLabel } from '@/lib/balance';
import { formatPaise, type Paise } from '@/lib/money';
import type { TypographyVariant } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

const ICONS: Record<BalanceLabel, string> = {
  will_get: 'arrow_downward',
  owe: 'arrow_upward',
  settled: 'check',
};

/** "You will get ₹7,000" / "You owe ₹6,000" / "Settled" — for messages and previews. */
export function balanceWords(balance: Paise): string {
  const label = balanceLabel(balance);
  if (label === 'settled') return strings.udhaar.settled;
  const amount = formatPaise(Math.abs(balance), { compact: true });
  return `${label === 'will_get' ? strings.udhaar.willGet : strings.udhaar.owe} ${amount}`;
}

export function BalanceText({
  balancePaise,
  variant = 'bodyStrong',
  stacked = false,
}: {
  balancePaise: Paise;
  variant?: TypographyVariant;
  /** Label above the amount (row layout); otherwise one line. */
  stacked?: boolean;
}) {
  const { colors, spacing } = useTheme();
  const label = balanceLabel(balancePaise);
  const color =
    label === 'will_get' ? colors.willGet : label === 'owe' ? colors.owe : colors.settled;
  const words = label === 'will_get' ? strings.udhaar.willGet : strings.udhaar.owe;
  const amount = formatPaise(Math.abs(balancePaise), { compact: true });

  if (label === 'settled') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Icon name={ICONS.settled} size={18} color={color} />
        <AppText variant={variant} style={{ color }}>
          {strings.udhaar.settled}
        </AppText>
      </View>
    );
  }
  if (stacked) {
    return (
      <View style={{ alignItems: 'flex-end' }} accessible accessibilityLabel={`${words} ${amount}`}>
        <AppText variant="caption" style={{ color }}>
          {words}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <AppText variant={variant} style={{ color }}>
            {amount}
          </AppText>
          <Icon name={ICONS[label]} size={16} color={color} />
        </View>
      </View>
    );
  }
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}
      accessible
      accessibilityLabel={`${words} ${amount}`}
    >
      <AppText variant={variant} style={{ color }}>
        {`${words} ${amount}`}
      </AppText>
      <Icon name={ICONS[label]} size={20} color={color} />
    </View>
  );
}
