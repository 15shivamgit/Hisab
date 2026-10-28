// All settings from one query, shared by the theme, app lock, onboarding, and the More tab.
// Re-reads when `app_settings` changes (useDbQuery + notifyChanged).

import { createContext, useContext, useEffect, type ReactNode } from 'react';

import type { Settings } from '@/db/repositories/settingsRepository';
import { useDbQuery, type DbQueryState } from '@/hooks/useDbQuery';
import { settings as settingsService } from '@/services/appServices';
import { useSetThemePreference } from '@/theme/ThemeProvider';

type SettingsQuery = DbQueryState<Settings> & { reload: () => void };

const SettingsContext = createContext<SettingsQuery | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const query = useDbQuery((db) => settingsService.getAll(db), [], { tables: ['app_settings'] });
  const setThemePreference = useSetThemePreference();
  const theme = query.status === 'success' ? query.data.theme : null;

  useEffect(() => {
    if (theme) setThemePreference(theme);
  }, [theme, setThemePreference]);

  return <SettingsContext.Provider value={query}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsQuery {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>');
  return value;
}
