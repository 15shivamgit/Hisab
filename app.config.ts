import type { ConfigContext, ExpoConfig } from 'expo/config';

// See docs/09-config/APP_CONFIG.md. APP_VARIANT=release builds the real app;
// anything else builds "Hisaab Dev", which installs next to it with its own data.
const IS_RELEASE = process.env.APP_VARIANT === 'release';

const BRAND_ICON_BACKGROUND = '#0284C7';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_RELEASE ? 'Hisaab' : 'Hisaab Dev',
  slug: 'hisaab',
  // Separate schemes so the dev and release apps don't both claim the same links.
  scheme: IS_RELEASE ? 'hisaab' : 'hisaab-dev',
  version: '1.0.0', // versionName shown to users
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  android: {
    package: IS_RELEASE ? 'com.shivambgs15.hisaab' : 'com.shivambgs15.hisaab.dev',
    versionCode: 1, // MUST increase for every APK given to anyone
    allowBackup: false, // ADR-010
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon-foreground.png',
      monochromeImage: './assets/images/adaptive-icon-monochrome.png',
      backgroundColor: BRAND_ICON_BACKGROUND,
    },
    predictiveBackGestureEnabled: false,
    // Each phase adds the permissions its feature needs (CAMERA in Phase 5,
    // POST_NOTIFICATIONS in Phase 7, USE_BIOMETRIC in Phase 9). The photo picker needs
    // no storage permission; expo-image-picker's storage permissions are blocked below.
    // POST_NOTIFICATIONS: udhaar return-by reminders (Phase 7), asked when a date is set.
    // DETECT_SCREEN_CAPTURE is not blocked: on Android 14+ expo-screen-capture registers a
    // screenshot callback when it loads and crashes without it (found on the phone, Phase 9).
    // It is a normal permission (no prompt, no access to images); its READ_* ones stay blocked.
    // USE_BIOMETRIC: app lock prompt (Phase 9); expo-local-authentication also adds the
    // deprecated USE_FINGERPRINT for Android 8 and older.
    permissions: [
      'android.permission.CAMERA',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.USE_BIOMETRIC',
    ],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      // Push delivery from Firebase (pulled in by expo-notifications); reminders are local.
      'com.google.android.c2dm.permission.RECEIVE',
      // ADR-012: release builds never reach the network. Dev builds need it for Metro.
      ...(IS_RELEASE ? ['android.permission.INTERNET'] : []),
    ],
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: BRAND_ICON_BACKGROUND,
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    ],
    [
      'expo-image-picker',
      {
        cameraPermission: 'Hisaab uses the camera to take photos of receipts.',
        microphonePermission: false,
      },
    ],
    // expo-document-picker and expo-sharing need no config plugin: Hisaab only opens the
    // system picker and sends files; it doesn't receive shares from other apps.
    // Local reminders only (no push config). White icon on transparent, brand colour.
    [
      'expo-notifications',
      { icon: './assets/images/notification-icon.png', color: BRAND_ICON_BACKGROUND },
    ],
    // Android 8.0+ only: Expo SDK 58 crashes on Android 7 (plugins/withMinSdk.js).
    './plugins/withMinSdk',
    // Release builds are signed with the owner's keystore (BUILD_AND_RELEASE.md).
    ...(IS_RELEASE ? ['./plugins/withReleaseSigning'] : []),
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
