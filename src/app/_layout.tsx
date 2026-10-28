import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastProvider } from '@/components/Toast';
import { LockGate } from '@/features/lock/LockGate';
import { OnboardingGate } from '@/features/onboarding/OnboardingGate';
import { StartupGate } from '@/features/startup/StartupGate';
import { SettingsProvider } from '@/hooks/SettingsContext';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

export default function RootLayout() {
  return (
    // Needed for gestures (receipt viewer pinch/zoom).
    <GestureHandlerRootView style={styles.fill}>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

function RootNavigator() {
  const { scheme, colors } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <ToastProvider>
        <StartupGate>
          <SettingsProvider>
            <LockGate>
              <OnboardingGate>
                <Stack
                  screenOptions={{
                    contentStyle: { backgroundColor: colors.bg },
                    headerStyle: { backgroundColor: colors.surface },
                    headerTintColor: colors.text,
                    headerShadowVisible: false,
                  }}
                >
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                </Stack>
              </OnboardingGate>
            </LockGate>
          </SettingsProvider>
        </StartupGate>
      </ToastProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}
