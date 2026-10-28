// Reports tab (REPORTS_AND_EXPORT.md § Reports tab; RPT-01…03).

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountText } from '@/components/AmountText';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CategoryIcon, categoryColor } from '@/components/CategoryIcon';
import { BarChart } from '@/components/charts/BarChart';
import { DonutChart, topSlices } from '@/components/charts/DonutChart';
import { DateField } from '@/components/DateField';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Icon } from '@/components/Icon';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { strings } from '@/content/strings';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import type { DateRange, TxnType } from '@/db/types';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useToday } from '@/hooks/useToday';
import { formatLocalDate, formatMonthYear, monthRange, type LocalDate } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { shareFile } from '@/platform/share';
import { exporter } from '@/services/appServices';
import { diagnostics } from '@/services/diagnostics';
import {
  periodFor,
  reportService,
  stepPeriod,
  type PeriodKind,
  type Report,
} from '@/services/reportService';
import { useDb } from '@/hooks/DatabaseContext';
import { useTheme } from '@/theme/ThemeProvider';

const PERIODS = [
  { value: 'week', label: strings.reports.week },
  { value: 'month', label: strings.reports.month },
  { value: 'custom', label: strings.reports.custom },
] as const;

const TYPES = [
  { value: 'expense', label: strings.txnType.expense },
  { value: 'income', label: strings.txnType.income },
] as const;

const money = (paise: number) => formatPaise(paise, { compact: true });

function periodTitle(kind: PeriodKind, range: DateRange): string {
  if (kind === 'month') return formatMonthYear(range.start);
  return `${formatLocalDate(range.start, 'short')} – ${formatLocalDate(range.end, 'long')}`;
}

export function ReportsScreen() {
  const db = useDb();
  const router = useRouter();
  const toast = useToast();
  const today = useToday();
  const { colors, spacing } = useTheme();
  const [kind, setKind] = useState<PeriodKind>('month');
  // The anchor date of the shown week/month; custom keeps its own range.
  const [anchor, setAnchor] = useState<LocalDate>(today);
  const [custom, setCustom] = useState<DateRange>(() => monthRange(today));
  const [type, setType] = useState<TxnType>('expense');
  const [exporting, setExporting] = useState(false);

  const query = useDbQuery(
    async (client) => {
      const weekStart = await settingsRepository.get(client, 'week_start');
      const range = kind === 'custom' ? custom : periodFor(kind, anchor, weekStart);
      return {
        weekStart,
        range,
        report: await reportService.getReport(client, range, today, weekStart),
      };
    },
    [kind, anchor, custom, today],
    { tables: ['transactions', 'categories', 'app_settings'] },
  );

  const customError = kind === 'custom' && custom.start > custom.end;

  const move = (delta: -1 | 1) => {
    if (query.status !== 'success' || kind === 'custom') return;
    const next = stepPeriod(query.data.range, kind, delta, today);
    if (next) setAnchor(next.start);
  };

  const exportCsv = async (range: DateRange) => {
    setExporting(true);
    try {
      const result = await exporter.transactionsCsv(db, range);
      if (!result) toast(strings.exportCsv.nothing);
      else {
        await shareFile(result.uri, 'text/csv', strings.exportCsv.shareTitle);
        toast(strings.exportCsv.done);
      }
    } catch (error) {
      void diagnostics.record(error, 'reports.csv');
      toast(strings.common.somethingWrong);
    } finally {
      setExporting(false);
    }
  };

  let body;
  if (query.status === 'loading') {
    body = (
      <View style={{ gap: spacing.md }}>
        <Skeleton height={96} />
        <Skeleton height={200} />
      </View>
    );
  } else if (query.status === 'error') {
    body = (
      <ErrorState
        title={strings.common.loadFailed}
        message={strings.common.somethingWrong}
        onRetry={query.reload}
      />
    );
  } else {
    const { range, report } = query.data;
    const canGoForward = kind !== 'custom' && stepPeriod(range, kind, 1, today) !== null;
    body = (
      <View style={{ gap: spacing.md }}>
        {kind !== 'custom' ? (
          <View style={[styles.row, styles.between]}>
            <Pressable
              onPress={() => move(-1)}
              accessibilityRole="button"
              accessibilityLabel={strings.reports.previous}
              hitSlop={12}
              style={styles.arrow}
            >
              <Icon name="chevron_left" color={colors.text} />
            </Pressable>
            <AppText variant="heading" accessibilityLiveRegion="polite">
              {periodTitle(kind, range)}
            </AppText>
            <Pressable
              onPress={() => move(1)}
              disabled={!canGoForward}
              accessibilityRole="button"
              accessibilityLabel={strings.reports.next}
              accessibilityState={{ disabled: !canGoForward }}
              hitSlop={12}
              style={[styles.arrow, { opacity: canGoForward ? 1 : 0.3 }]}
            >
              <Icon name="chevron_right" color={colors.text} />
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <DateField
              label={strings.reports.from}
              value={custom.start}
              onChange={(start) => setCustom((r) => ({ ...r, start }))}
              today={today}
              shortcuts={false}
            />
            <DateField
              label={strings.reports.to}
              value={custom.end}
              onChange={(end) => setCustom((r) => ({ ...r, end }))}
              today={today}
              shortcuts={false}
              error={customError ? strings.errors['date.invalid'] : undefined}
            />
          </View>
        )}

        {customError ? null : report.isEmpty ? (
          <EmptyState title={strings.reports.empty} />
        ) : (
          <ReportBody
            report={report}
            type={type}
            onType={setType}
            today={today}
            onCategory={(categoryId) =>
              router.navigate({
                pathname: '/transactions',
                params: { categoryId, type, start: range.start, end: range.end },
              })
            }
          />
        )}

        <AppText variant="caption" color="textMuted">
          {strings.reports.udhaarNote}
        </AppText>
        {!customError ? (
          <Button
            label={strings.reports.exportCsv}
            variant="secondary"
            onPress={() => void exportCsv(range)}
            loading={exporting}
          />
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.fill}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl }}
      >
        <AppText variant="title" accessibilityRole="header">
          {strings.reports.title}
        </AppText>
        <SegmentedControl
          options={PERIODS}
          value={kind}
          onChange={(k) => {
            setKind(k);
            setAnchor(today);
          }}
          accessibilityLabel={strings.reports.title}
        />
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

function ReportBody({
  report,
  type,
  onType,
  today,
  onCategory,
}: {
  report: Report;
  type: TxnType;
  onType: (t: TxnType) => void;
  today: LocalDate;
  onCategory: (categoryId: string) => void;
}) {
  const { colors, spacing } = useTheme();
  const slices = report.categories[type];
  const total = type === 'expense' ? report.expensePaise : report.incomePaise;
  const typeLabel = strings.txnType[type];
  const barColor = type === 'expense' ? colors.primary : colors.income;

  const bars = report.trend.bars.map((b, i) => {
    const day = Number(b.start.slice(8));
    const label = report.trend.unit === 'day' ? String(day) : formatLocalDate(b.start, 'short');
    const every = report.trend.bars.length > 14 ? 7 : 1;
    return {
      key: b.start,
      value: type === 'expense' ? b.expensePaise : b.incomePaise,
      label,
      showLabel: report.trend.unit === 'week' ? i % 2 === 0 : i % every === 0,
      current: b.start <= today && today <= b.end,
    };
  });
  const maxBar = Math.max(0, ...bars.map((b) => b.value));

  return (
    <View style={{ gap: spacing.md }}>
      <Card style={{ gap: spacing.sm }}>
        <View style={[styles.row, styles.wrap, { gap: spacing.lg }]}>
          <View>
            <AppText variant="caption" color="textMuted">
              {strings.dash.income}
            </AppText>
            <AmountText paise={report.incomePaise} kind="income" compact />
          </View>
          <View>
            <AppText variant="caption" color="textMuted">
              {strings.dash.expense}
            </AppText>
            <AmountText paise={report.expensePaise} kind="expense" compact />
          </View>
        </View>
        <View>
          <AppText variant="caption" color="textMuted">
            {strings.dash.net}
          </AppText>
          <AmountText paise={report.netPaise} kind="net" variant="title" compact />
        </View>
        <AppText variant="caption" color="textMuted">
          {`${strings.reports.avgPerDay}: ${money(report.avgSpendPerDayPaise)}`}
        </AppText>
        {report.upcoming.count > 0 ? (
          <AppText variant="caption" color="warning">
            {strings.reports.upcoming(
              report.upcoming.count,
              money(report.upcoming.expensePaise + report.upcoming.incomePaise),
            )}
          </AppText>
        ) : null}
      </Card>

      <SegmentedControl
        options={TYPES}
        value={type}
        onChange={onType}
        accessibilityLabel={strings.reports.byCategory}
      />

      <Card style={{ gap: spacing.md }}>
        <AppText variant="heading">{strings.reports.byCategory}</AppText>
        {slices.length === 0 ? (
          <AppText color="textMuted">{strings.reports.noData(typeLabel)}</AppText>
        ) : (
          <>
            <View style={styles.center}>
              <DonutChart
                slices={topSlices(
                  slices.map((s) => ({
                    key: s.categoryId,
                    value: s.totalPaise,
                    color: categoryColor(s.categoryColor),
                  })),
                  5,
                  colors.textMuted,
                )}
                centerTop={typeLabel}
                centerBottom={money(total)}
                accessibilityLabel={strings.reports.donutLabel(
                  typeLabel,
                  slices
                    .slice(0, 5)
                    .map((s) => `${s.categoryName} ${s.percent}%`)
                    .join(', '),
                )}
              />
            </View>
            {slices.map((s) => (
              <Pressable
                key={s.categoryId}
                onPress={() => onCategory(s.categoryId)}
                accessibilityRole="button"
                accessibilityLabel={`${s.categoryName}, ${money(s.totalPaise)}, ${s.percent} percent, ${strings.reports.entries(s.count)}`}
                style={({ pressed }) => [
                  styles.row,
                  { gap: spacing.md, paddingVertical: spacing.xs, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <CategoryIcon icon={s.categoryIcon} color={s.categoryColor} size={36} />
                <View style={styles.fill}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {s.categoryName}
                  </AppText>
                  <AppText variant="caption" color="textMuted">
                    {`${s.percent}% · ${strings.reports.entries(s.count)}`}
                  </AppText>
                </View>
                <AppText variant="bodyStrong">{money(s.totalPaise)}</AppText>
                <Icon name="chevron_right" size={20} color={colors.textMuted} />
              </Pressable>
            ))}
          </>
        )}
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <View style={[styles.row, styles.between]}>
          <AppText variant="heading">{strings.reports.trend}</AppText>
          <AppText variant="caption" color="textMuted">
            {report.trend.unit === 'day' ? strings.reports.trendDaily : strings.reports.trendWeekly}
          </AppText>
        </View>
        <BarChart
          bars={bars}
          color={barColor}
          accessibilityLabel={strings.reports.trendLabel(
            typeLabel,
            report.trend.unit === 'day' ? strings.reports.trendDaily : strings.reports.trendWeekly,
            money(maxBar),
          )}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexWrap: 'wrap' },
  between: { justifyContent: 'space-between' },
  center: { alignItems: 'center' },
  arrow: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
