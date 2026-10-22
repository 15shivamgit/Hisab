import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { formatAmountInput } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';

interface AmountInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  autoFocus?: boolean;
}

/** Large ₹ amount with Indian grouping while typing (UI_UX_GUIDE.md § Components). */
export function AmountInput({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  autoFocus,
}: AmountInputProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label" color="textMuted">
        {label}
      </AppText>
      <View
        style={[
          styles.row,
          { borderBottomColor: error ? colors.danger : colors.border, gap: spacing.sm },
        ]}
      >
        <AppText variant="display" color="textMuted">
          ₹
        </AppText>
        <TextInput
          value={value}
          onChangeText={(text) => onChangeText(formatAmountInput(text))}
          onBlur={onBlur}
          autoFocus={autoFocus}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={label}
          testID="amount-input"
          style={[
            styles.input,
            typography.display,
            { color: colors.text, fontVariant: ['tabular-nums'] },
          ]}
        />
      </View>
      {error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2 },
  input: { flex: 1, paddingVertical: 8 },
});
