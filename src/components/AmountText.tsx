import type { TextStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import type { TxnType } from '@/db/types';
import { formatPaise, type Paise } from '@/lib/money';
import type { TypographyVariant } from '@/theme/tokens';

interface AmountTextProps {
  paise: Paise;
  /** income → "+₹" green; expense → "−₹" normal text (colour plus sign, NFR-09); net → green/red by sign. */
  kind?: TxnType | 'net' | 'neutral';
  variant?: TypographyVariant;
  compact?: boolean;
  style?: TextStyle;
}

export function AmountText({
  paise,
  kind = 'neutral',
  variant = 'bodyStrong',
  compact = false,
  style,
}: AmountTextProps) {
  const signed = kind === 'expense' ? -Math.abs(paise) : paise;
  const text = formatPaise(signed, { compact, sign: kind === 'income' });
  const color =
    kind === 'income' || (kind === 'net' && paise >= 0)
      ? 'income'
      : kind === 'net'
        ? 'danger'
        : 'text';
  const spoken = `${kind === 'income' ? 'Income, ' : kind === 'expense' ? 'Expense, ' : ''}${
    paise < 0 && kind !== 'expense' ? 'minus ' : ''
  }${formatPaise(Math.abs(paise), { compact: true }).replace('₹', '')} rupees`;
  return (
    <AppText variant={variant} color={color} tabular style={style} accessibilityLabel={spoken}>
      {text}
    </AppText>
  );
}
