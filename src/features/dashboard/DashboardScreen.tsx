import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountText } from '@/components/AmountText';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CategoryIcon, categoryColor } from '@/components/CategoryIcon';
import { DonutChart } from '@/components/charts/DonutChart';
import { ErrorState } from '@/components/ErrorState';
import { ListRow } from '@/components/ListRow';
import { Skeleton } from '@/components/Skeleton';
import { strings } from '@/content/strings';
import type { TxnType, UdhaarDirection } from '@/db/types';
import { BackupNudge } from '@/features/dashboard/components/BackupNudge';
import { BudgetCard } from '@/features/dashboard/components/BudgetCard';
import { UdhaarCard } from '@/features/dashboard/components/UdhaarCard';
import { TransactionRow } from '@/features/transactions/components/TransactionRow';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useToday } from '@/hooks/useToday';
import { formatMonthYear } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { dashboardService } from '@/services/dashboardService';
import { useTheme } from '@/theme/ThemeProvider';

export function DashboardScreen() {
  const router = useRouter();
  const today = useToday();
  const { colors, spacing } = useTheme();
  const summary = useDbQuery((db) => dashboardService.getSummary(db, today), [today], {
    tables: ['transactions', 'categories', 'app_settings', 'people', 'udhaar_entries', 'budgets'],
  });

  const add = (type: TxnType) => router.push({ pathname: '/transaction/new', params: { type } });
  const udhaarEntry = (direction: UdhaarDirection) =>
    router.push({ pathname: '/person/pick', params: { direction } });

  const quickActions = (
    <View style={{ gap: spacing.sm }}>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <View style={styles.fill}>
          <Button label={`+ ${strings.quick.addExpense}`} onPress={() => add('expense')} />
        </View>
        <View style={styles.fill}>
          <Button
            label={`+ ${strings.quick.addIncome}`}
            variant="secondary"
            onPress={() => add('income')}
          />
        </View>
      </View>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <View style={styles.fill}>
          <Button
            label={strings.quick.gave}
            variant="secondary"
            onPress={() => udhaarEntry('gave')}
          />
        </View>
        <View style={styles.fill}>
          <Button
            label={strings.quick.got}
            variant="secondary"
            onPress={() => udhaarEntry('got')}
          />
        </View>
      </View>
    </View>
  );

  let body;
  if (summary.status === 'loading') {
    body = (
      <View style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.sm }}>
          <Skeleton width="40%" />
          <Skeleton height={34} />
          <Skeleton width="70%" />
        </Card>
        <Skeleton height={48} />
        <Card style={{ gap: spacing.sm }}>
          <Skeleton width="50%" />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </Card>
      </View>
    );
  } else if (summary.status === 'error') {
    body = (
      <ErrorState
        title={strings.common.loadFailed}
        message={strings.common.somethingWrong}
        onRetry={summary.reload}
      />
    );
  } else if (!summary.data.hasAnyTransactions) {
    body = (
      <View style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="heading">{strings.dash.welcomeTitle}</AppText>
          <AppText color="textMuted">{strings.dash.welcomeMessage}</AppText>
        </Card>
        {quickActions}
        {summary.data.udhaar ? (
          <UdhaarCard
            totals={summary.data.udhaar.totals}
            attention={summary.data.udhaar.attention}
            today={today}
          />
        ) : null}
      </View>
    );
  } else {
    const s = summary.data;
    body = (
      <View style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="heading">{strings.dash.thisMonth}</AppText>
          <View style={[styles.row, styles.wrap, { gap: spacing.lg }]}>
            <View>
              <AppText variant="caption" color="textMuted">
                {strings.dash.income}
              </AppText>
              <AmountText paise={s.incomePaise} kind="income" compact />
            </View>
            <View>
              <AppText variant="caption" color="textMuted">
                {strings.dash.expense}
              </AppText>
              <AmountText paise={s.expensePaise} kind="expense" compact />
            </View>
          </View>
          <View style={{ gap: 2 }}>
            <AppText variant="caption" color="textMuted">
              {strings.dash.net}
            </AppText>
            <AmountText paise={s.netPaise} kind="net" variant="display" compact />
          </View>
          <AppText variant="caption" color="textMuted">
            {strings.dash.netCaption}
          </AppText>
        </Card>

        {quickActions}

        {s.udhaar ? (
          <UdhaarCard totals={s.udhaar.totals} attention={s.udhaar.attention} today={today} />
        ) : null}

        <BudgetCard data={s.budgets} />

        <Card style={{ gap: spacing.xs }}>
          <AppText variant="heading">{strings.dash.spendingByCategory}</AppText>
          {s.topCategories.length === 0 ? (
            <AppText color="textMuted">{strings.dash.noSpending}</AppText>
          ) : (
            <>
              <View style={[styles.center, { marginVertical: spacing.sm }]}>
                <DonutChart
                  slices={[
                    ...s.topCategories.map((c) => ({
                      key: c.categoryId,
                      value: c.totalPaise,
                      color: categoryColor(c.categoryColor),
                    })),
                    {
                      key: '__other',
                      value:
                        s.expensePaise - s.topCategories.reduce((sum, c) => sum + c.totalPaise, 0),
                      color: colors.textMuted,
                    },
                  ]}
                  size={150}
                  centerTop={strings.dash.expense}
                  centerBottom={formatPaise(s.expensePaise, { compact: true })}
                  accessibilityLabel={strings.reports.donutLabel(
                    strings.dash.expense,
                    s.topCategories.map((c) => `${c.categoryName} ${c.percent}%`).join(', '),
                  )}
                />
              </View>
              {s.topCategories.map((c) => (
                <ListRow
                  key={c.categoryId}
                  title={c.categoryName}
                  subtitle={`${c.percent}%`}
                  left={<CategoryIcon icon={c.categoryIcon} color={c.categoryColor} />}
                  right={<AmountText paise={c.totalPaise} compact />}
                  accessibilityLabel={`${c.categoryName}, ${c.percent} percent`}
                  onPress={() =>
                    router.navigate({
                      pathname: '/transactions',
                      params: {
                        categoryId: c.categoryId,
                        type: 'expense',
                        start: s.month.start,
                        end: s.month.end,
                      },
                    })
                  }
                />
              ))}
            </>
          )}
        </Card>

        <Card style={{ gap: spacing.xs }}>
          <View style={[styles.row, styles.between]}>
            <AppText variant="heading">{strings.dash.recent}</AppText>
            <Button
              label={strings.common.seeAll}
              variant="ghost"
              onPress={() => router.navigate('/transactions')}
            />
          </View>
          {s.recent.map((t) => (
            <TransactionRow
              key={t.id}
              item={t}
              onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.id } })}
            />
          ))}
        </Card>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.fill}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl }}
      >
        <AppText variant="title" accessibilityRole="header">
          {formatMonthYear(today)}
        </AppText>
        <BackupNudge today={today} />
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexWrap: 'wrap' },
  between: { justifyContent: 'space-between' },
  center: { alignItems: 'center' },
});
