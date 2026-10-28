import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Toggle } from '@/components/Toggle';
import { useToast } from '@/components/Toast';
import { strings } from '@/content/strings';
import { useDb } from '@/hooks/DatabaseContext';
import { systemClock } from '@/lib/clock';
import { deviceLock } from '@/platform/deviceLock';
import { runWithoutLock } from '@/platform/lockSession';
import { settings as settingsService } from '@/services/appServices';
import { diagnostics } from '@/services/diagnostics';
import { useTheme } from '@/theme/ThemeProvider';

const STEPS = [
  { icon: 'smartphone', ...strings.onboarding.offline },
  { icon: 'backup', ...strings.onboarding.backup },
  { icon: 'lock', ...strings.onboarding.lock },
] as const;

export function OnboardingScreen() {
  const db = useDb();
  const toast = useToast();
  const { colors, spacing } = useTheme();
  const [step, setStep] = useState(0);
  const [lockOn, setLockOn] = useState(false);
  const [lockNote, setLockNote] = useState<string>();
  const [saving, setSaving] = useState(false);
  const current = STEPS[step] ?? STEPS[0];
  const last = step === STEPS.length - 1;

  const toggleLock = async (on: boolean) => {
    setLockNote(undefined);
    if (!on) {
      setLockOn(false);
      return;
    }
    try {
      if (!(await deviceLock.hasScreenLock())) {
        setLockNote(strings.lock.needsScreenLock);
        return;
      }
      const result = await runWithoutLock(() =>
        deviceLock.authenticate(strings.lock.confirmPrompt),
      );
      if (result === 'success') setLockOn(true);
    } catch (error) {
      void diagnostics.record(error, 'onboarding.lock');
      setLockNote(strings.common.somethingWrong);
    }
  };

  const finish = async () => {
    setSaving(true);
    try {
      if (lockOn) await settingsService.setAppLock(db, systemClock, true);
      await settingsService.completeOnboarding(db, systemClock);
    } catch (error) {
      void diagnostics.record(error, 'onboarding.finish');
      toast(strings.common.somethingWrong);
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={[styles.grow, { padding: spacing.lg, gap: spacing.lg }]}>
        <View style={[styles.center, { gap: spacing.md }]}>
          <Icon name={current.icon} size={64} color={colors.primary} />
          <AppText variant="title" accessibilityRole="header" style={styles.text}>
            {current.title}
          </AppText>
          <AppText color="textMuted" style={styles.text}>
            {current.body}
          </AppText>
          {last ? (
            <Card style={[styles.lockRow, { gap: spacing.md, alignSelf: 'stretch' }]}>
              <View style={styles.fill}>
                <AppText variant="bodyStrong">{strings.onboarding.lockToggle}</AppText>
                <AppText variant="caption" color="textMuted">
                  {strings.lock.screenshotNote}
                </AppText>
              </View>
              <Toggle
                value={lockOn}
                onValueChange={(on) => void toggleLock(on)}
                accessibilityLabel={strings.onboarding.lockToggle}
              />
            </Card>
          ) : null}
          {lockNote ? (
            <AppText color="warning" style={styles.text}>
              {lockNote}
            </AppText>
          ) : null}
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText
            variant="caption"
            color="textMuted"
            style={styles.text}
            accessibilityLabel={strings.onboarding.stepOf(step + 1, STEPS.length)}
          >
            {STEPS.map((_, i) => (i === step ? '●' : '○')).join('  ')}
          </AppText>
          {last ? (
            <Button
              label={strings.onboarding.getStarted}
              onPress={() => void finish()}
              loading={saving}
            />
          ) : (
            <Button label={strings.onboarding.next} onPress={() => setStep((s) => s + 1)} />
          )}
          {step > 0 ? (
            <Button
              label={strings.common.back}
              variant="ghost"
              onPress={() => setStep((s) => s - 1)}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { textAlign: 'center' },
  lockRow: { flexDirection: 'row', alignItems: 'center' },
});
