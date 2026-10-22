// The app's diagnostics instance (device file system + real clock).
import { systemClock } from '@/lib/clock';
import { getAppAndDeviceInfo } from '@/platform/deviceInfo';
import { documentTextFiles } from '@/platform/files';
import { createDiagnosticsService } from '@/services/diagnosticsService';

export const diagnostics = createDiagnosticsService({
  files: documentTextFiles,
  clock: systemClock,
  appVersion: getAppAndDeviceInfo().appVersion,
});
