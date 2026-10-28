// App lock (SETTINGS_AND_APP_LOCK.md § App lock, SET-02, ADR-011, ADR-016).
// Cold start with lock on: nothing below this gate mounts (no data is queried) until the
// user unlocks. Locking again later covers the app with a Modal, so screens stay mounted
// underneath and unsaved form input survives; a Modal also covers any open sheet.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, BackHandler, Modal, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/ErrorState';
import { useToast } from '@/components/Toast';
import { strings } from '@/content/strings';
import { LockScreen } from '@/features/lock/LockScreen';
import { useDb } from '@/hooks/DatabaseContext';
import { useSettings } from '@/hooks/SettingsContext';
import { shouldLockOnReturn, type LockTimeoutSeconds } from '@/lib/appLock';
import { systemClock } from '@/lib/clock';
import { deviceLock } from '@/platform/deviceLock';
import { lockSession, runWithoutLock } from '@/platform/lockSession';
import { settings as settingsService } from '@/services/appServices';
import { diagnostics } from '@/services/diagnostics';
import { useTheme } from '@/theme/ThemeProvider';

type Phase = 'checking' | 'locked' | 'open';

export function LockGate({ children }: { children: ReactNode }) {
  const db = useDb();
  const toast = useToast();
  const { colors } = useTheme();
  const settings = useSettings();
  const loaded = settings.status === 'success' ? settings.data : null;
  const enabled = loaded?.app_lock_enabled ?? null;

  const [phase, setPhase] = useState<Phase>('checking');
  // Screens below the gate mount only after the first unlock (or straight away if lock is off).
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);

  // Read inside the AppState listener, which is registered once.
  const config = useRef<{ enabled: boolean; timeout: LockTimeoutSeconds }>({
    enabled: false,
    timeout: 60,
  });
  const phaseRef = useRef<Phase>('checking');
  const away = useRef<{ at: number; systemScreen: boolean } | null>(null);
  const authInFlight = useRef(false);

  useEffect(() => {
    if (loaded) {
      config.current = {
        enabled: loaded.app_lock_enabled,
        timeout: loaded.app_lock_timeout_seconds,
      };
    }
  }, [loaded]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const open = () => {
    away.current = null;
    setPhase('open');
    setMounted(true);
  };

  /** The phone's screen lock was removed: turn app lock off and say so once. */
  const turnOff = async () => {
    await settingsService.setAppLock(db, systemClock, false);
    toast(strings.lock.turnedOff);
    open();
  };

  const unlock = async () => {
    if (authInFlight.current || AppState.currentState !== 'active') return;
    authInFlight.current = true;
    setBusy(true);
    try {
      if (!(await deviceLock.hasScreenLock())) {
        await turnOff();
        return;
      }
      // The prompt (and the PIN screen behind it) is a system screen: no re-lock on return.
      const result = await runWithoutLock(() => deviceLock.authenticate(strings.lock.prompt));
      if (result === 'success') open();
    } catch (error) {
      void diagnostics.record(error, 'lock.unlock');
    } finally {
      authInFlight.current = false;
      setBusy(false);
    }
  };
  const unlockRef = useRef(unlock);
  useEffect(() => {
    unlockRef.current = unlock;
  });

  // First decision once settings are known (cold start), made during render so the
  // screens below never render a frame before it.
  if (phase === 'checking' && enabled !== null) {
    if (enabled) {
      setPhase('locked');
    } else {
      setPhase('open');
      setMounted(true);
    }
  }

  // Ask for authentication whenever the lock screen appears while the app is in front.
  useEffect(() => {
    if (phase === 'locked') void unlockRef.current();
  }, [phase]);

  // Secure flag follows the setting: blank recents preview, screenshots blocked (ADR-016).
  useEffect(() => {
    if (enabled === null) return;
    deviceLock
      .setSecureFlag(enabled)
      .catch((error: unknown) => diagnostics.record(error, 'lock.secureFlag'));
  }, [enabled]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const now = systemClock.now().getTime();
      if (state === 'background') {
        const systemScreen = lockSession.isSystemScreenTrip(now);
        away.current = { at: now, systemScreen };
        // "Immediately": cover now, so nothing shows for a moment on return.
        if (config.current.enabled && !systemScreen && config.current.timeout === 0) {
          setPhase('locked');
        }
      } else if (state === 'active') {
        const trip = away.current;
        away.current = null;
        if (phaseRef.current === 'locked') {
          void unlockRef.current();
        } else if (
          trip &&
          shouldLockOnReturn({
            enabled: config.current.enabled,
            timeoutSeconds: config.current.timeout,
            backgroundAt: trip.at,
            systemScreen: trip.systemScreen,
            now,
          })
        ) {
          setPhase('locked');
        }
      }
    });
    return () => subscription.remove();
  }, []);

  // Back on the lock screen leaves the app; it never reveals what is underneath.
  useEffect(() => {
    if (phase !== 'locked') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp();
      return true;
    });
    return () => subscription.remove();
  }, [phase]);

  if (settings.status === 'error') {
    return (
      <View style={[styles.fill, { backgroundColor: colors.bg }]}>
        <ErrorState
          title={strings.common.loadFailed}
          message={strings.common.somethingWrong}
          onRetry={settings.reload}
        />
      </View>
    );
  }

  const lockScreen = <LockScreen busy={busy} onUnlock={() => void unlock()} />;

  if (!mounted) {
    return phase === 'locked' ? (
      lockScreen
    ) : (
      <View style={[styles.fill, { backgroundColor: colors.bg }]} />
    );
  }

  return (
    <>
      {children}
      <Modal
        visible={phase === 'locked'}
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => BackHandler.exitApp()}
      >
        {lockScreen}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
