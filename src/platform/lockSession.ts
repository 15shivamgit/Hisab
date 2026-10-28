// Remembers when Hisaab itself opens a system screen (camera, photo picker, document
// picker, share sheet, WhatsApp/SMS link, Android settings, the unlock prompt), so coming
// back from it within 5 minutes does not lock (ADR-016). In memory only.

import { isSystemScreenTrip } from '@/lib/appLock';
import { systemClock, type Clock } from '@/lib/clock';

export function createLockSession(clock: Clock) {
  let openCount = 0;
  let lastOpenedAt: number | null = null;

  return {
    /** Wraps every call that opens a system screen. */
    async runWithoutLock<T>(fn: () => Promise<T>): Promise<T> {
      openCount++;
      lastOpenedAt = clock.now().getTime();
      try {
        return await fn();
      } finally {
        openCount--;
      }
    },

    /** Called when the app goes to the background. */
    isSystemScreenTrip(backgroundAt: number): boolean {
      return isSystemScreenTrip({ openCount, lastOpenedAt, backgroundAt });
    },
  };
}

export const lockSession = createLockSession(systemClock);

export const runWithoutLock = <T>(fn: () => Promise<T>): Promise<T> =>
  lockSession.runWithoutLock(fn);
