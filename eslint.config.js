// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  globalIgnores(['dist/*', 'android/*', 'ios/*', 'coverage/*']),
  expoConfig,
  // Formatting is Prettier's job (`npm run lint` also runs `prettier --check`).
  prettierConfig,
]);
