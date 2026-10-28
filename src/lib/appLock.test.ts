import {
  SYSTEM_SCREEN_GRACE_MS,
  SYSTEM_SCREEN_START_WINDOW_MS,
  isSystemScreenTrip,
  shouldLockOnReturn,
} from '@/lib/appLock';

const base = {
  enabled: true,
  timeoutSeconds: 60 as const,
  backgroundAt: 1_000,
  systemScreen: false,
};

describe('shouldLockOnReturn', () => {
  test('never locks when app lock is off', () => {
    expect(shouldLockOnReturn({ ...base, enabled: false, now: 10_000_000 })).toBe(false);
  });

  test('never locks if the app never went to the background', () => {
    expect(shouldLockOnReturn({ ...base, backgroundAt: null, now: 10_000_000 })).toBe(false);
  });

  test('respects the timeout (lock at exactly the timeout)', () => {
    expect(shouldLockOnReturn({ ...base, now: 1_000 + 59_999 })).toBe(false);
    expect(shouldLockOnReturn({ ...base, now: 1_000 + 60_000 })).toBe(true);
  });

  test('"Immediately" locks after any time away', () => {
    expect(shouldLockOnReturn({ ...base, timeoutSeconds: 0, now: 1_000 })).toBe(true);
  });

  test('system screen: no lock within 5 minutes, even with "Immediately"', () => {
    const s = { ...base, timeoutSeconds: 0 as const, systemScreen: true };
    expect(shouldLockOnReturn({ ...s, now: 1_000 + SYSTEM_SCREEN_GRACE_MS })).toBe(false);
    expect(shouldLockOnReturn({ ...s, now: 1_000 + SYSTEM_SCREEN_GRACE_MS + 1 })).toBe(true);
  });

  test('a clock that went backwards counts as zero time away', () => {
    expect(shouldLockOnReturn({ ...base, now: 0 })).toBe(false);
    expect(shouldLockOnReturn({ ...base, timeoutSeconds: 0, now: 0 })).toBe(true);
  });
});

describe('isSystemScreenTrip', () => {
  test('a system screen still open counts', () => {
    expect(isSystemScreenTrip({ openCount: 1, lastOpenedAt: 0, backgroundAt: 999_999 })).toBe(true);
  });

  test('one opened just before going to the background counts', () => {
    expect(
      isSystemScreenTrip({
        openCount: 0,
        lastOpenedAt: 1_000,
        backgroundAt: 1_000 + SYSTEM_SCREEN_START_WINDOW_MS,
      }),
    ).toBe(true);
  });

  test('an old one or none does not count', () => {
    expect(
      isSystemScreenTrip({
        openCount: 0,
        lastOpenedAt: 1_000,
        backgroundAt: 1_001 + SYSTEM_SCREEN_START_WINDOW_MS,
      }),
    ).toBe(false);
    expect(isSystemScreenTrip({ openCount: 0, lastOpenedAt: null, backgroundAt: 5 })).toBe(false);
  });
});
