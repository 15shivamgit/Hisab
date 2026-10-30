// Minimum Android version: 8.0 (API 26). Expo SDK 58 modules use Java classes that only
// exist from Android 8 (java.nio.file, java.time), so on Android 7 the app crashes at
// start (seen on an API 24 emulator in Phase 10, release and debug builds). With minSdk
// 26 the Play/installer simply refuses Android 7 phones. Owner decision 2026-10-30.
// Expo's autolinking plugin reads `android.minSdkVersion` from gradle.properties.

const { withGradleProperties } = require('expo/config-plugins');

const MIN_SDK = '26';

module.exports = function withMinSdk(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'android.minSdkVersion'),
    );
    cfg.modResults.push({ type: 'property', key: 'android.minSdkVersion', value: MIN_SDK });
    return cfg;
  });
};
