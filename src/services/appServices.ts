// App instances of services that use device files and notifications.
import type { DbClient } from '@/db/client';
import { systemClock, type Clock } from '@/lib/clock';
import { deviceBackupFiles } from '@/platform/backupFiles';
import { deviceNotifications } from '@/platform/notifications';
import { createDataService } from '@/services/dataService';
import { diagnostics } from '@/services/diagnostics';
import { createExportService } from '@/services/exportService';
import { createReminderService } from '@/services/reminderService';
import { createUdhaarService } from '@/services/udhaarService';

export const reminders = createReminderService(deviceNotifications);

/** A reminder failure never undoes or blocks the data change that caused it. */
export function replanReminders(db: DbClient, clock: Clock = systemClock): Promise<unknown> {
  return reminders
    .reconcile(db, clock)
    .catch((error: unknown) => diagnostics.record(error, 'reminders'));
}

export const exporter = createExportService(deviceBackupFiles);
export const dataService = createDataService(deviceBackupFiles, replanReminders);
export const udhaar = createUdhaarService({ afterChange: replanReminders });
