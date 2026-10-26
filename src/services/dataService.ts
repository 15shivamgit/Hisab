// Delete all data (SET-06, SETTINGS_AND_APP_LOCK.md § Delete all data, SERVICES_AND_LIBS.md
// § dataService). Default categories come back; portable and device settings stay.

import { notifyChanged } from '@/db/changes';
import type { DbClient } from '@/db/client';
import { backupRepository } from '@/db/repositories/backupRepository';
import { categoryRepository } from '@/db/repositories/categoryRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import type { Clock } from '@/lib/clock';
import type { BackupFiles } from '@/platform/backupFiles';

/** Everything a deleted entry or receipt could still live in. */
const DOCUMENT_PATHS = [
  'receipts',
  'backups',
  'receipts-incoming',
  'receipts-old',
  'restore-journal.json',
];
const CACHE_PATHS = ['staging', 'exports'];

export function createDataService(files: BackupFiles) {
  return {
    async deleteAllData(db: DbClient, clock: Clock): Promise<void> {
      const now = clock.now();
      await db.transaction(async (tx) => {
        await backupRepository.deleteAll(tx);
        await categoryRepository.seedDefaultsIfEmpty(tx, now);
        await settingsRepository.set(tx, 'data_changed_since_backup', false, now);
        await settingsRepository.set(tx, 'backup_nudge_dismissed_until', null, now);
      });
      // After the commit, so a failure can't leave rows pointing at deleted files.
      for (const path of DOCUMENT_PATHS) files.remove(files.documentUri(path));
      for (const path of CACHE_PATHS) files.remove(files.cacheUri(path));
      // Phase 7: cancel scheduled udhaar reminders here.
      notifyChanged('all');
    },
  };
}
