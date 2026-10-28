// More → Preferences: theme (SET-01), week start (SET-04), udhaar reminders (SET-03).

import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { ListRow } from '@/components/ListRow';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Toggle } from '@/components/Toggle';
import { useToast } from '@/components/Toast';
import { strings } from '@/content/strings';
import type { Settings } from '@/db/repositories/settingsRepository';
import { useDb } from '@/hooks/DatabaseContext';
import { systemClock } from '@/lib/clock';
import { openAppSettings } from '@/platform/system';
import { reminders, settings as settingsService } from '@/services/appServices';
import { diagnostics } from '@/services/diagnostics';
import { useTheme } from '@/theme/ThemeProvider';

const THEMES = (['system', 'light', 'dark'] as const).map((value) => ({
  value,
  label: strings.more.themeOptions[value],
}));
const WEEK_STARTS = (['monday', 'sunday'] as const).map((value) => ({
  value,
  label: strings.more.weekStartOptions[value],
}));

/** '09:00' → a Date today at that time, for the picker. */
function timeToDate(time: string): Date {
  const [h = 9, m = 0] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function PreferencesCard({ settings }: { settings: Settings }) {
  const db = useDb();
  const toast = useToast();
  const { colors, spacing } = useTheme();
  const [notificationsOff, setNotificationsOff] = useState(false);

  const run = async (where: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (error) {
      void diagnostics.record(error, where);
      toast(strings.common.somethingWrong);
    }
  };

  const setReminders = (on: boolean) =>
    run('settings.reminders', async () => {
      await settingsService.setRemindersEnabled(db, systemClock, on);
      setNotificationsOff(on && (await reminders.ensurePermission()) === 'denied');
    });

  const pickTime = () =>
    DateTimePickerAndroid.open({
      value: timeToDate(settings.reminder_time),
      mode: 'time',
      onValueChange: (_event, date) =>
        void run('settings.reminderTime', () =>
          settingsService.setReminderTime(
            db,
            systemClock,
            `${pad(date.getHours())}:${pad(date.getMinutes())}`,
          ),
        ),
    });

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="label" color="textMuted">
          {strings.more.theme}
        </AppText>
        <SegmentedControl
          options={THEMES}
          value={settings.theme}
          onChange={(theme) =>
            void run('settings.theme', () => settingsService.setTheme(db, systemClock, theme))
          }
          accessibilityLabel={strings.more.theme}
        />
      </View>

      <View style={{ gap: spacing.xs }}>
        <AppText variant="label" color="textMuted">
          {strings.more.weekStart}
        </AppText>
        <SegmentedControl
          options={WEEK_STARTS}
          value={settings.week_start}
          onChange={(weekStart) =>
            void run('settings.weekStart', () =>
              settingsService.setWeekStart(db, systemClock, weekStart),
            )
          }
          accessibilityLabel={strings.more.weekStart}
        />
      </View>

      <ListRow
        title={strings.more.reminders}
        subtitle={strings.more.remindersHint}
        left={<Icon name="notifications" color={colors.primary} />}
        right={
          <Toggle
            value={settings.reminders_enabled}
            onValueChange={(on) => void setReminders(on)}
            accessibilityLabel={strings.more.reminders}
          />
        }
      />
      {settings.reminders_enabled ? (
        <ListRow
          title={strings.more.reminderTime}
          left={<Icon name="schedule" color={colors.primary} />}
          right={<AppText variant="bodyStrong">{settings.reminder_time}</AppText>}
          onPress={pickTime}
          accessibilityLabel={`${strings.more.reminderTime}, ${settings.reminder_time}`}
        />
      ) : null}
      {notificationsOff && settings.reminders_enabled ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" color="warning">
            {strings.more.notificationsOff}
          </AppText>
          <Button
            label={strings.more.openSettings}
            variant="secondary"
            onPress={() => void openAppSettings()}
          />
        </View>
      ) : null}
    </Card>
  );
}
