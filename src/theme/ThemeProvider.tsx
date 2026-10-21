import { createContext, useContext, useMemo, type ReactNode } from 'react';
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

export function resolveScheme(
  preference: ThemePreference,
  systemScheme: string | null | undefined,
): ColorScheme {
  if (preference !== 'system') return preference;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

interface ThemeProviderProps {
  /** Comes from settings once the database exists (Phase 3); follows the system until then. */
  preference?: ThemePreference;
  children: ReactNode;
}

export function ThemeProvider({ preference = 'system', children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const scheme = resolveScheme(preference, systemScheme);

  const theme = useMemo<Theme>(
    () => ({ scheme, colors: colors[scheme], spacing, radius, typography }),
    [scheme],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}
