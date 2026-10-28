// Settings writes (SETTINGS_AND_APP_LOCK.md, SET-01…04, SET-08). Portable settings (theme,
// week start, reminders) travel in backups, so they mark data as changed since the last
// backup; device-only settings (app lock, onboarding) do not (ARCHITECTURE.md § Tracking
// changes since the last backup).

import { notifyChanged } from '@/db/changes';
import type { DbClient } from '@/db/client';
import {
  markDataChanged,
  settingsRepository,
  type Settings,
} from '@/db/repositories/settingsRepository';
import type { LockTimeoutSeconds } from '@/lib/appLock';
import type { Clock } from '@/lib/clock';

type PortableKey = 'theme' | 'week_start' | 'reminders_enabled' | 'reminder_time';
type DeviceKey = 'app_lock_enabled' | 'app_lock_timeout_seconds' | 'onboarding_completed';

export interface SettingsServiceDeps {
  /** Re-plans udhaar reminders (their time, on/off, and generic text while locked). */
  afterRemindersChange: (db: DbClient) => Promise<unknown>;
}

export function createSettingsService({ afterRemindersChange }: SettingsServiceDeps) {
  async function setPortable<K extends PortableKey>(
    db: DbClient,
    clock: Clock,
    key: K,
    value: Settings[K],
  ): Promise<void> {
    const now = clock.now();
    await db.transaction(async (tx) => {
      await settingsRepository.set(tx, key, value, now);
      await markDataChanged(tx, now);
    });
    notifyChanged(['app_settings']);
  }

  async function setDevice<K extends DeviceKey>(
    db: DbClient,
    clock: Clock,
    key: K,
    value: Settings[K],
  ): Promise<void> {
    await settingsRepository.set(db, key, value, clock.now());
    notifyChanged(['app_settings']);
  }

  return {
    getAll: (db: DbClient): Promise<Settings> => settingsRepository.getAll(db),

    setTheme: (db: DbClient, clock: Clock, theme: Settings['theme']) =>
      setPortable(db, clock, 'theme', theme),

    setWeekStart: (db: DbClient, clock: Clock, weekStart: Settings['week_start']) =>
      setPortable(db, clock, 'week_start', weekStart),

    async setRemindersEnabled(db: DbClient, clock: Clock, enabled: boolean): Promise<void> {
      await setPortable(db, clock, 'reminders_enabled', enabled);
      await afterRemindersChange(db);
    },

    /** `time` is 'HH:MM' (24 h). */
    async setReminderTime(db: DbClient, clock: Clock, time: string): Promise<void> {
      await setPortable(db, clock, 'reminder_time', time);
      await afterRemindersChange(db);
    },

    /** The caller has already checked the screen lock and authenticated once. */
    async setAppLock(db: DbClient, clock: Clock, enabled: boolean): Promise<void> {
      await setDevice(db, clock, 'app_lock_enabled', enabled);
      // Reminder text is generic while app lock is on.
      await afterRemindersChange(db);
    },

    setLockTimeout: (db: DbClient, clock: Clock, seconds: LockTimeoutSeconds) =>
      setDevice(db, clock, 'app_lock_timeout_seconds', seconds),

    completeOnboarding: (db: DbClient, clock: Clock) =>
      setDevice(db, clock, 'onboarding_completed', true),
  };
}

export type SettingsService = ReturnType<typeof createSettingsService>;
