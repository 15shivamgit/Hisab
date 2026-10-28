// Device authentication (expo-local-authentication) and the secure window flag
// (expo-screen-capture) for app lock (SETTINGS_AND_APP_LOCK.md § App lock, ADR-011, ADR-016).

import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';

export type AuthResult = 'success' | 'cancelled' | 'failed';

export interface DeviceLock {
  /** The phone has a PIN, pattern, or password (biometrics are optional on top). */
  hasScreenLock(): Promise<boolean>;
  /** Biometrics with the device PIN/pattern/password as fallback. */
  authenticate(promptMessage: string): Promise<AuthResult>;
  /** Secure flag: blank recents preview, no screenshots or screen recording. */
  setSecureFlag(on: boolean): Promise<void>;
}

const SECURE_FLAG_KEY = 'app-lock';

export const deviceLock: DeviceLock = {
  async hasScreenLock() {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level >= LocalAuthentication.SecurityLevel.SECRET;
  },

  async authenticate(promptMessage) {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      // Device PIN/pattern/password is allowed, so phones without a fingerprint work too.
      disableDeviceFallback: false,
    });
    if (result.success) return 'success';
    return result.error === 'user_cancel' ||
      result.error === 'system_cancel' ||
      result.error === 'app_cancel'
      ? 'cancelled'
      : 'failed';
  },

  async setSecureFlag(on) {
    if (on) await ScreenCapture.preventScreenCaptureAsync(SECURE_FLAG_KEY);
    else await ScreenCapture.allowScreenCaptureAsync(SECURE_FLAG_KEY);
  },
};
