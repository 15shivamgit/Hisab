// More → Export CSV (RPT-04, REPORTS_AND_EXPORT.md § CSV export). Udhaar CSV (RPT-05)
// joins in Phase 7; the Reports tab gets its own export button in Phase 8.

import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { DateField } from '@/components/DateField';
import { Screen } from '@/components/Screen';
import { useToast } from '@/components/Toast';
import { strings } from '@/content/strings';
import { useDb } from '@/hooks/DatabaseContext';
import { useToday } from '@/hooks/useToday';
import { monthRange, shiftPeriod, type DateRange } from '@/lib/dates';
import { shareFile } from '@/platform/share';
import { exporter } from '@/services/appServices';
import { diagnostics } from '@/services/diagnostics';
import { useTheme } from '@/theme/ThemeProvider';

type Period = 'thisMonth' | 'lastMonth' | 'all' | 'custom';
const PERIODS: readonly Period[] = ['thisMonth', 'lastMonth', 'all', 'custom'];

export function ExportScreen() {
  const db = useDb();
  const toast = useToast();
  const today = useToday();
  const { spacing } = useTheme();
  const [period, setPeriod] = useState<Period>('thisMonth');
  const [custom, setCustom] = useState<DateRange>(() => monthRange(today));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const rangeError = period === 'custom' && custom.start > custom.end;

  const rangeFor = (p: Period): DateRange | null => {
    if (p === 'thisMonth') return monthRange(today);
    if (p === 'lastMonth') return shiftPeriod(monthRange(today), 'month', -1);
    if (p === 'custom') return custom;
    return null;
  };

  const run = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await exporter.transactionsCsv(db, rangeFor(period));
      if (!result) {
        setMessage(strings.exportCsv.nothing);
        return;
      }
      await shareFile(result.uri, 'text/csv', strings.exportCsv.shareTitle);
      toast(strings.exportCsv.done);
    } catch (error) {
      void diagnostics.record(error, 'export.csv');
      setMessage(strings.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={{ gap: spacing.lg }}>
        <AppText color="textMuted">{strings.exportCsv.intro}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {PERIODS.map((p) => (
            <Chip
              key={p}
              label={strings.exportCsv[p]}
              selected={period === p}
              role="radio"
              onPress={() => {
                setPeriod(p);
                setMessage(null);
              }}
            />
          ))}
        </View>
        {period === 'custom' ? (
          <View style={{ gap: spacing.md }}>
            <DateField
              label={strings.exportCsv.from}
              value={custom.start}
              onChange={(start) => setCustom((r) => ({ ...r, start }))}
              today={today}
            />
            <DateField
              label={strings.exportCsv.to}
              value={custom.end}
              onChange={(end) => setCustom((r) => ({ ...r, end }))}
              today={today}
              error={rangeError ? strings.errors['date.invalid'] : undefined}
            />
          </View>
        ) : null}
        <Button
          label={busy ? strings.exportCsv.exporting : strings.exportCsv.export}
          onPress={() => void run()}
          loading={busy}
          disabled={rangeError}
        />
        {message ? (
          <AppText color="textMuted" accessibilityLiveRegion="polite">
            {message}
          </AppText>
        ) : null}
        <AppText variant="caption" color="textMuted">
          {strings.exportCsv.note}
        </AppText>
      </View>
    </Screen>
  );
}
