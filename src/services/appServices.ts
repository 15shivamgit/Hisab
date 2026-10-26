// App instances of the Phase 6 services that work on device files.
import { deviceBackupFiles } from '@/platform/backupFiles';
import { createDataService } from '@/services/dataService';
import { createExportService } from '@/services/exportService';

export const exporter = createExportService(deviceBackupFiles);
export const dataService = createDataService(deviceBackupFiles);
