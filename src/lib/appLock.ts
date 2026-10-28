// App lock timing rules (SETTINGS_AND_APP_LOCK.md § App lock, ADR-016). Pure: times are
// milliseconds from the caller's clock.

/** Returning from a system screen Hisaab opened itself within this time never locks. */
export const SYSTEM_SCREEN_GRACE_MS = 5 * 60 * 1000;

/**
 * Some system screens (WhatsApp/SMS links, Android's text share) resolve before the app
 * actually goes to the background, so a background that starts this soon after one was
 * opened still counts as "Hisaab opened it".
 */
export const SYSTEM_SCREEN_START_WINDOW_MS = 10 * 1000;

export type LockTimeoutSeconds = 0 | 30 | 60 | 300;

export const LOCK_TIMEOUTS: readonly LockTimeoutSeconds[] = [0, 30, 60, 300];

/** Was this trip to the background caused by a system screen Hisaab opened? */
export function isSystemScreenTrip(input: {
  openCount: number;
  lastOpenedAt: number | null;
  backgroundAt: number;
}): boolean {
  if (input.openCount > 0) return true;
  return (
    input.lastOpenedAt !== null &&
    input.backgroundAt - input.lastOpenedAt >= 0 &&
    input.backgroundAt - input.lastOpenedAt <= SYSTEM_SCREEN_START_WINDOW_MS
  );
}

/** Should the app lock when it comes back to the foreground? */
export function shouldLockOnReturn(input: {
  enabled: boolean;
  timeoutSeconds: LockTimeoutSeconds;
  backgroundAt: number | null;
  systemScreen: boolean;
  now: number;
}): boolean {
  if (!input.enabled || input.backgroundAt === null) return false;
  const away = Math.max(0, input.now - input.backgroundAt);
  if (input.systemScreen && away <= SYSTEM_SCREEN_GRACE_MS) return false;
  return away >= input.timeoutSeconds * 1000;
}
