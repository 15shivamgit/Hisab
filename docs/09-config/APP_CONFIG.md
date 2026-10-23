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

### Verified in Phase 2 (SDK 58, 2026-10-21)

The real file is [`app.config.ts`](../../app.config.ts). Differences from the sketch above and what was checked:

- `android.allowBackup`, `android.permissions`, `android.blockedPermissions` (uses `tools:node="remove"`), `android.adaptiveIcon.monochromeImage` are current keys (Expo app config reference).
- `permissions: []` at first — each phase adds only what its feature needs (CAMERA in Phase 5, POST_NOTIFICATIONS in Phase 7, USE_BIOMETRIC in Phase 9). The `expo-image-picker`, `expo-notifications`, and `expo-local-authentication` plugins are added in those phases.
- **Phase 5 (2026-10-23):** `permissions: ['android.permission.CAMERA']` and the plugin `['expo-image-picker', { cameraPermission: 'Hisaab uses the camera to take photos of receipts.', microphonePermission: false }]`. The storage/media permissions that expo-image-picker can add stay in `blockedPermissions`; the gallery uses the Android photo picker, which needs none. Checked on the phone: picking from the gallery works with no storage permission, and the only runtime permission the dev app has is CAMERA (asked on first "Take photo").
- **Scheme:** dev variant uses `hisaab-dev` so the dev and release apps don't both claim `hisaab://`.
- Icon files: `assets/images/icon.png`, `adaptive-icon-foreground.png`, `adaptive-icon-monochrome.png`, `splash-icon.png`; splash and adaptive background `#0284C7`.
- `npx expo prebuild --platform android` output inspected for both variants:
  - release: `applicationId 'com.shivambgs15.hisaab'`, `versionCode 1`, `versionName "1.0.0"`, `android:allowBackup="false"`, INTERNET and all blocked permissions marked `tools:node="remove"`, scheme `hisaab`;
  - development: `com.shivambgs15.hisaab.dev`, name "Hisaab Dev", INTERNET present (Metro), scheme `hisaab-dev`.
  - The template manifest also declares `android.permission.VIBRATE` (harmless, no prompt).
- **Merged manifest verified on a built release APK (2026-10-22, `aapt dump badging`):** permissions are only `android.permission.VIBRATE` and `com.shivambgs15.hisaab.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (added by AndroidX; a signature-level permission private to the app). No INTERNET. `allowBackup=0x0`. minSdk 24, targetSdk 36, compileSdk 37.

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
