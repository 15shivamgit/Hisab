# App Configuration

Status: Approved (`Verify:` every config key against current Expo docs in Phase 2) · Last updated: 2026-10-21

## Variants

| | Development | Release |
|---|---|---|
| `APP_VARIANT` env | `development` (default) | `release` |
| App name | Hisaab Dev | Hisaab |
| Application ID | `com.shivambgs15.hisaab.dev` | `com.shivambgs15.hisaab` (Q1 — decided 2026-10-21; **cannot change later** without losing the update path) |
| Dev client | yes | no |
| INTERNET permission | yes (Metro) | blocked (ADR-012) |
| Developer screen (seed test data, file listing) | yes | not included |

## `app.config.ts` (sketch)

```ts
import type { ExpoConfig } from 'expo/config';

const IS_RELEASE = process.env.APP_VARIANT === 'release';

const config: ExpoConfig = {
  name: IS_RELEASE ? 'Hisaab' : 'Hisaab Dev',
  slug: 'hisaab',
  scheme: 'hisaab',
  version: '1.0.0',                 // versionName shown to users
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',  // light/dark
  icon: './assets/icon.png',
  android: {
    package: IS_RELEASE ? 'com.shivambgs15.hisaab' : 'com.shivambgs15.hisaab.dev',
    versionCode: 1,                 // MUST increase for every APK given to anyone
    allowBackup: false,             // ADR-010
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#0284C7' },
    permissions: ['android.permission.CAMERA', 'android.permission.POST_NOTIFICATIONS',
                  'android.permission.USE_BIOMETRIC'],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_MEDIA_IMAGES',   // Verify: photo picker works without it
      'android.permission.READ_MEDIA_VIDEO',
      ...(IS_RELEASE ? ['android.permission.INTERNET'] : []),
    ],
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    ['expo-image-picker', { cameraPermission: 'Hisaab uses the camera to take photos of receipts.', microphonePermission: false }],
    ['expo-notifications', { /* local only; no push config */ }],
    ['expo-local-authentication', { faceIDPermission: false }],
    // './plugins/withReleaseSigning'  — only if building release locally with Gradle (BUILD_AND_RELEASE.md)
  ],
};

export default config;
```

`Verify:` exact plugin option names, whether `android.allowBackup` is still the right key, the exact permission strings each library adds, and whether any library requires a permission in the blocked list.

## Versioning

| Field | Rule |
|---|---|
| `version` (versionName) | Semantic: `1.0.0` first friend release; `1.1.0` features; `1.0.1` fixes |
| `android.versionCode` | Integer, +1 for **every** APK given to anyone. Android refuses to install a lower `versionCode` over a higher one. |

Record each build in CHANGELOG.md with both values.

## `.gitignore` additions

```
*.jks
*.keystore
credentials.json
android/
ios/
*.hisaab
*.apk
*.aab
```
