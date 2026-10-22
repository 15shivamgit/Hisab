import Constants from 'expo-constants';
import { Platform } from 'react-native';

export interface AppAndDeviceInfo {
  appVersion: string;
  versionCode: string;
  androidVersion: string;
  device: string;
}

/** Versions and device model for diagnostics. No personal data. */
export function getAppAndDeviceInfo(): AppAndDeviceInfo {
  const config = Constants.expoConfig;
  const constants = Platform.constants as { Brand?: string; Model?: string; Release?: string };
  return {
    appVersion: config?.version ?? 'unknown',
    versionCode: String(config?.android?.versionCode ?? 'unknown'),
    androidVersion: `${constants.Release ?? '?'} (API ${String(Platform.Version)})`,
    device: [constants.Brand, constants.Model].filter(Boolean).join(' ') || 'unknown',
  };
}
