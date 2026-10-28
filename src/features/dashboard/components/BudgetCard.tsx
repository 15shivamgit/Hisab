// Dashboard budget card (DASH-04): overall progress + up to 3 category budgets with the
// highest percentage. Empty: "Set a monthly budget".

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { strings } from '@/content/strings';
import { BudgetNumbers } from '@/features/budgets/BudgetsScreen';
import type { BudgetLine } from '@/services/budgetService';
import { useTheme } from '@/theme/ThemeProvider';

export function BudgetCard({
  data,
}: {
  data: { overall: BudgetLine | null; top: BudgetLine[] } | null;
}) {
  const router = useRouter();
  const { spacing } = useTheme();
  const open = () => router.push('/budgets');

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={[styles.row, styles.between]}>
        <AppText variant="heading">{strings.budgets.dashTitle}</AppText>
        {data ? <Button label={strings.budgets.manage} variant="ghost" onPress={open} /> : null}
      </View>
      {!data ? (
        <Button label={strings.budgets.dashEmpty} variant="secondary" onPress={open} />
      ) : (
        <>
          {data.overall ? (
            <View style={{ gap: spacing.xs }}>
              <AppText variant="bodyStrong">{strings.budgets.overall}</AppText>
              <ProgressBar
                percent={data.overall.progress.percent}
                state={data.overall.progress.state}
              />
              <BudgetNumbers line={data.overall} />
            </View>
          ) : null}
          {data.top.map((line) => (
            <View key={line.budget.id} style={{ gap: spacing.xs }}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {line.category?.name ?? ''}
              </AppText>
              <ProgressBar percent={line.progress.percent} state={line.progress.state} />
              <BudgetNumbers line={line} />
            </View>
          ))}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { justifyContent: 'space-between' },
});
