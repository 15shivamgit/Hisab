// Key/value settings stored as JSON (DATABASE_SCHEMA.md § app_settings).

import { z } from 'zod';

import type { DbClient } from '@/db/client';
import { isValidLocalDate, toIsoDateTime } from '@/lib/dates';
import { AppError } from '@/lib/errors';

const isoOrNull = z.string().min(1).nullable();

const settingSchemas = {
  theme: z.enum(['system', 'light', 'dark']),
  week_start: z.enum(['monday', 'sunday']),
  reminders_enabled: z.boolean(),
  reminder_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  app_lock_enabled: z.boolean(),
  app_lock_timeout_seconds: z.union([z.literal(0), z.literal(30), z.literal(60), z.literal(300)]),
  onboarding_completed: z.boolean(),
  last_backup_at: isoOrNull,
  data_changed_since_backup: z.boolean(),
  backup_nudge_dismissed_until: z.string().refine(isValidLocalDate).nullable(),
  last_orphan_sweep_at: isoOrNull,
  restore_marker: z.string().min(1).nullable(),
};

export type SettingKey = keyof typeof settingSchemas;
export type Settings = { [K in SettingKey]: z.infer<(typeof settingSchemas)[K]> };
export type SettingValue<K extends SettingKey> = Settings[K];

export const SETTING_DEFAULTS: Settings = {
  theme: 'system',
  week_start: 'monday',
  reminders_enabled: true,
  reminder_time: '09:00',
  app_lock_enabled: false,
  app_lock_timeout_seconds: 60,
  onboarding_completed: false,
  last_backup_at: null,
  data_changed_since_backup: false,
  backup_nudge_dismissed_until: null,
  last_orphan_sweep_at: null,
  restore_marker: null,
};

/** Settings that travel inside backups. All others are device-specific. */
export const PORTABLE_SETTING_KEYS = [
  'theme',
  'week_start',
  'reminders_enabled',
  'reminder_time',
] as const satisfies readonly SettingKey[];

export type PortableSettings = Pick<Settings, (typeof PORTABLE_SETTING_KEYS)[number]>;

function decode<K extends SettingKey>(key: K, raw: string | undefined): SettingValue<K> {
  if (raw === undefined) return SETTING_DEFAULTS[key];
  try {
    const parsed = settingSchemas[key].safeParse(JSON.parse(raw));
    // A corrupted value falls back to the default instead of breaking the app.
    return parsed.success ? (parsed.data as SettingValue<K>) : SETTING_DEFAULTS[key];
  } catch {
    return SETTING_DEFAULTS[key];
  }
}

export const settingsRepository = {
  async get<K extends SettingKey>(db: DbClient, key: K): Promise<SettingValue<K>> {
    const row = await db.get<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [
      key,
    ]);
    return decode(key, row?.value);
  },

  async set<K extends SettingKey>(
    db: DbClient,
    key: K,
    value: SettingValue<K>,
    now: Date,
  ): Promise<void> {
    if (!settingSchemas[key].safeParse(value).success) {
      throw new AppError('VALIDATION', 'Invalid setting value', { detail: `SETTING_${key}` });
    }
    await db.run(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, JSON.stringify(value), toIsoDateTime(now)],
    );
  },

  async getAll(db: DbClient): Promise<Settings> {
    const rows = await db.all<{ key: string; value: string }>(
      'SELECT key, value FROM app_settings',
    );
    const stored = new Map(rows.map((row) => [row.key, row.value]));
    const result = { ...SETTING_DEFAULTS };
    for (const key of Object.keys(settingSchemas) as SettingKey[]) {
      (result as Record<SettingKey, unknown>)[key] = decode(key, stored.get(key));
    }
    return result;
  },

  async portableEntries(db: DbClient): Promise<PortableSettings> {
    const all = await settingsRepository.getAll(db);
    return {
      theme: all.theme,
      week_start: all.week_start,
      reminders_enabled: all.reminders_enabled,
      reminder_time: all.reminder_time,
    };
  },

  /** Restore: replaces portable settings only; device-only keys stay as they are. */
  async replacePortable(db: DbClient, entries: PortableSettings, now: Date): Promise<void> {
    for (const key of PORTABLE_SETTING_KEYS) {
      await settingsRepository.set(db, key, entries[key], now);
    }
  },
};

/**
 * Every write that changes user data calls this inside the same transaction
 * (ARCHITECTURE.md § Tracking changes since the last backup).
 */
export function markDataChanged(tx: DbClient, now: Date): Promise<void> {
  return settingsRepository.set(tx, 'data_changed_since_backup', true, now);
}
