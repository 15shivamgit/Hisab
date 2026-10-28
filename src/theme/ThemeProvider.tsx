import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  colors,
  radius,
  spacing,
  typography,
  type ColorScheme,
  type ColorTokens,
} from '@/theme/tokens';

/** Matches the `theme` setting (docs/03-database/DATABASE_SCHEMA.md, SET-01). */
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Theme {
  scheme: ColorScheme;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
}

const ThemeContext = createContext<Theme | null>(null);
const SetPreferenceContext = createContext<((preference: ThemePreference) => void) | null>(null);

export function resolveScheme(
  preference: ThemePreference,
  systemScheme: string | null | undefined,
): ColorScheme {
  if (preference !== 'system') return preference;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

interface ThemeProviderProps {
  /** Starting preference. The `theme` setting replaces it once the database is open
   *  (SettingsProvider → useSetThemePreference); until then the app follows the system. */
  preference?: ThemePreference;
  children: ReactNode;
}

export function ThemeProvider({ preference: initial = 'system', children }: ThemeProviderProps) {
  const [preference, setPreference] = useState<ThemePreference>(initial);
  const systemScheme = useColorScheme();
  const scheme = resolveScheme(preference, systemScheme);

  const theme = useMemo<Theme>(
    () => ({ scheme, colors: colors[scheme], spacing, radius, typography }),
    [scheme],
  );

  return (
    <SetPreferenceContext.Provider value={setPreference}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </SetPreferenceContext.Provider>
  );
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}

export function useSetThemePreference(): (preference: ThemePreference) => void {
  const set = useContext(SetPreferenceContext);
  if (!set) throw new Error('useSetThemePreference must be used inside <ThemeProvider>');
  return set;
}
