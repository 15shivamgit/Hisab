// Dashboard backup reminder (DASH-08, BAK-06; rule in BACKUP_AND_RESTORE.md § Backup reminder).

import { notifyChanged } from '@/db/changes';
import type { DbClient } from '@/db/client';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import type { Clock } from '@/lib/clock';
import { addDays, todayLocal, type LocalDate } from '@/lib/dates';

const DAY_MS = 24 * 60 * 60 * 1000;
export const NUDGE_MIN_ENTRIES = 10;
export const NUDGE_MAX_AGE_DAYS = 7;
export const NUDGE_SNOOZE_DAYS = 3;

export interface NudgeInput {
  dataChangedSinceBackup: boolean;
  lastBackupAt: string | null;
  dismissedUntil: LocalDate | null;
  /** Transactions + udhaar entries. */
  entryCount: number;
}

/** null = hide; otherwise whole days since the last backup (null inside = never backed up). */
export function backupNudgeFor(input: NudgeInput, now: Date): { daysSince: number | null } | null {
  if (!input.dataChangedSinceBackup) return null;
  if (input.dismissedUntil !== null && input.dismissedUntil >= todayLocal(now)) return null;
  if (input.lastBackupAt === null) {
    return input.entryCount >= NUDGE_MIN_ENTRIES ? { daysSince: null } : null;
  }
  const ageMs = now.getTime() - Date.parse(input.lastBackupAt);
  return ageMs > NUDGE_MAX_AGE_DAYS * DAY_MS ? { daysSince: Math.floor(ageMs / DAY_MS) } : null;
}

export const backupNudgeService = {
  async get(db: DbClient, now: Date) {
    const settings = await settingsRepository.getAll(db);
    const row = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM transactions');
    return backupNudgeFor(
      {
        dataChangedSinceBackup: settings.data_changed_since_backup,
        lastBackupAt: settings.last_backup_at,
        dismissedUntil: settings.backup_nudge_dismissed_until,
        entryCount: row?.n ?? 0,
      },
      now,
    );
  },

  /** Hides the nudge for 3 days. */
  async dismiss(db: DbClient, clock: Clock): Promise<void> {
    const now = clock.now();
    await settingsRepository.set(
      db,
      'backup_nudge_dismissed_until',
      addDays(todayLocal(now), NUDGE_SNOOZE_DAYS),
      now,
    );
    notifyChanged(['app_settings']);
  },
};
