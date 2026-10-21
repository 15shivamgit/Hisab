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
    // POST_NOTIFICATIONS in Phase 7, USE_BIOMETRIC in Phase 9).
    permissions: [],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
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
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
