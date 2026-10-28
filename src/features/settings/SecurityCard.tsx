// More → Security: app lock and "Lock after" (SET-02, ADR-011, ADR-016).

import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { ListRow } from '@/components/ListRow';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Toggle } from '@/components/Toggle';
import { useToast } from '@/components/Toast';
import { strings } from '@/content/strings';
import type { Settings } from '@/db/repositories/settingsRepository';
import { useDb } from '@/hooks/DatabaseContext';
import { LOCK_TIMEOUTS, type LockTimeoutSeconds } from '@/lib/appLock';
import { systemClock } from '@/lib/clock';
import { deviceLock } from '@/platform/deviceLock';
import { runWithoutLock } from '@/platform/lockSession';
import { settings as settingsService } from '@/services/appServices';
import { diagnostics } from '@/services/diagnostics';
import { useTheme } from '@/theme/ThemeProvider';

// SegmentedControl values are strings.
const TIMEOUTS = LOCK_TIMEOUTS.map((seconds) => ({
  value: String(seconds) as `${LockTimeoutSeconds}`,
  label: strings.more.lockAfterOptions[seconds],
}));

export function SecurityCard({ settings }: { settings: Settings }) {
  const db = useDb();
  const toast = useToast();
  const { colors, spacing } = useTheme();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();

  const setLock = async (on: boolean) => {
    setNote(undefined);
    setBusy(true);
    try {
      if (on) {
        // Enable: the phone needs a screen lock, and the user confirms once.
        if (!(await deviceLock.hasScreenLock())) {
          setNote(strings.lock.needsScreenLock);
          return;
        }
        const result = await runWithoutLock(() =>
          deviceLock.authenticate(strings.lock.confirmPrompt),
        );
        if (result !== 'success') return;
      }
      await settingsService.setAppLock(db, systemClock, on);
      if (on) toast(strings.lock.turnedOn);
    } catch (error) {
      void diagnostics.record(error, 'settings.appLock');
      toast(strings.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  };

  const changeTimeout = (value: `${LockTimeoutSeconds}`) =>
    settingsService
      .setLockTimeout(db, systemClock, Number(value) as LockTimeoutSeconds)
      .catch((error: unknown) => {
        void diagnostics.record(error, 'settings.lockTimeout');
        toast(strings.common.somethingWrong);
      });

  return (
    <Card style={{ gap: spacing.md }}>
      <ListRow
        title={strings.more.appLock}
        subtitle={strings.more.appLockHint}
        left={<Icon name="lock" color={colors.primary} />}
        right={
          <Toggle
            value={settings.app_lock_enabled}
            disabled={busy}
            onValueChange={(on) => void setLock(on)}
            accessibilityLabel={strings.more.appLock}
          />
        }
      />
      {note ? (
        <AppText variant="caption" color="warning">
          {note}
        </AppText>
      ) : null}
      {settings.app_lock_enabled ? (
        <>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="label" color="textMuted">
              {strings.more.lockAfter}
            </AppText>
            <SegmentedControl
              options={TIMEOUTS}
              value={String(settings.app_lock_timeout_seconds) as `${LockTimeoutSeconds}`}
              onChange={(value) => void changeTimeout(value)}
              accessibilityLabel={strings.more.lockAfter}
            />
          </View>
          <AppText variant="caption" color="textMuted">
            {strings.lock.screenshotNote}
          </AppText>
        </>
      ) : null}
    </Card>
  );
}
