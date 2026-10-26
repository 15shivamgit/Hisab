// The app's backup service (device files, expo-crypto SHA-256).
import { deviceBackupFiles } from '@/platform/backupFiles';
import { getAppAndDeviceInfo } from '@/platform/deviceInfo';
import { sha256Hex } from '@/platform/hash';
import { createBackupService } from '@/services/backup/backupService';
import { receipts } from '@/services/receipts';

/** Debug builds only: set by the dev tools screen to pause a restore for the crash test. */
export const restoreDebug: { pauseMs: { db: number; files: number } } = {
  pauseMs: { db: 0, files: 0 },
};

export const backup = createBackupService({
  files: deviceBackupFiles,
  sha256: sha256Hex,
  sweepOrphans: (db, now) => receipts.sweepOrphans(db, now),
  appVersion: getAppAndDeviceInfo().appVersion,
  pauseAt: __DEV__
    ? (stage) => new Promise((resolve) => setTimeout(resolve, restoreDebug.pauseMs[stage]))
    : undefined,
});
