import { View } from 'react-native';

import { AmountText } from '@/components/AmountText';
import { AppText } from '@/components/AppText';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Icon } from '@/components/Icon';
import { ListRow } from '@/components/ListRow';
import { strings } from '@/content/strings';
import type { TransactionListItem } from '@/db/types';
import { formatPaise } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';

interface TransactionRowProps {
  item: TransactionListItem;
  upcoming?: boolean;
  onPress: () => void;
}

export function TransactionRow({ item, upcoming = false, onPress }: TransactionRowProps) {
  const { colors, spacing } = useTheme();
  const title = item.description ?? item.categoryName;
  const subtitle = [
    item.description ? item.categoryName : null,
    strings.paymentMethod[item.paymentMethod],
  ]
    .filter(Boolean)
    .join(' · ');
  const label = `${strings.txnType[item.type]}, ${formatPaise(item.amountPaise)}, ${title}, ${subtitle}${
    upcoming ? `, ${strings.txn.upcoming}` : ''
  }${item.attachmentCount > 0 ? `, ${item.attachmentCount} receipts` : ''}`;
  return (
    <ListRow
      title={title}
      subtitle={subtitle}
      onPress={onPress}
      accessibilityLabel={label}
      testID={`txn-row-${item.id}`}
      left={<CategoryIcon icon={item.categoryIcon} color={item.categoryColor} />}
      right={
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            {item.attachmentCount > 0 ? (
              <Icon name="receipt_long" size={16} color={colors.textMuted} />
            ) : null}
            <AmountText paise={item.amountPaise} kind={item.type} />
          </View>
          {upcoming ? (
            <AppText variant="caption" color="warning">
              {strings.txn.upcoming}
            </AppText>
          ) : null}
        </View>
      }
    />
  );
}
