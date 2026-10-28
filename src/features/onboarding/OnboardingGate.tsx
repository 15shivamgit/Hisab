// First-run onboarding (SETTINGS_AND_APP_LOCK.md § Onboarding, SET-08), shown once until
// `onboarding_completed` is set. Sits inside the lock gate.

import type { ReactNode } from 'react';

import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { useSettings } from '@/hooks/SettingsContext';

export function OnboardingGate({ children }: { children: ReactNode }) {
  const settings = useSettings();
  // The lock gate above already handles loading and errors.
  if (settings.status !== 'success') return null;
  if (!settings.data.onboarding_completed) return <OnboardingScreen />;
  return children;
}
