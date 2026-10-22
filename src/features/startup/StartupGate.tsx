import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/ErrorState';
import { Screen } from '@/components/Screen';
import { strings } from '@/content/strings';
import { DatabaseProvider } from '@/hooks/DatabaseContext';
import { systemClock } from '@/lib/clock';
import type { AppError } from '@/lib/errors';
import { getAppAndDeviceInfo } from '@/platform/deviceInfo';
import { diagnostics } from '@/services/diagnostics';
import { startDatabase, type StartedDatabase } from '@/services/startupService';
import { useTheme } from '@/theme/ThemeProvider';

type StartupState =
  | { status: 'loading' }
  | { status: 'ready'; started: StartedDatabase }
  | { status: 'error'; error: AppError };

/** Opens the database before any data screen renders (ARCHITECTURE.md § Startup sequence). */
export function StartupGate({ children }: { children: ReactNode }) {
  const { colors, spacing } = useTheme();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<StartupState>({ status: 'loading' });

  useEffect(() => {
    let current = true;
    startDatabase(systemClock).then(
      (started) => current && setState({ status: 'ready', started }),
      (error: AppError) => current && setState({ status: 'error', error }),
    );
    return () => {
      current = false;
    };
  }, [attempt]);

  if (state.status === 'ready') {
    return <DatabaseProvider db={state.started.db}>{children}</DatabaseProvider>;
  }

  if (state.status === 'loading') {
    return (
      <Screen>
        <View style={[styles.center, { gap: spacing.md }]}>
          <ActivityIndicator color={colors.primary} size="large" />
          <AppText color="textMuted">{strings.startup.loading}</AppText>
        </View>
      </Screen>
    );
  }

  const newer = state.error.code === 'DB_NEWER';
  const shareDiagnostics = async () => {
    const message = await diagnostics.buildReport(getAppAndDeviceInfo());
    await Share.share({ message });
  };

  return (
    <Screen>
      <ErrorState
        title={newer ? strings.startup.dbNewerTitle : strings.startup.errorTitle}
        message={newer ? strings.startup.dbNewerMessage : strings.startup.errorMessage}
        onRetry={
          newer
            ? undefined
            : () => {
                setState({ status: 'loading' });
                setAttempt((a) => a + 1);
              }
        }
        retryLabel={strings.common.tryAgain}
        secondaryAction={{ label: strings.startup.shareDiagnostics, onPress: shareDiagnostics }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
