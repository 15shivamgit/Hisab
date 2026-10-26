const { addReleaseSigning } = require('./withReleaseSigning');

// The part of the Expo SDK 58 template the plugin edits.
const TEMPLATE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}`;

test('release builds use the owner keystore and fail without it; debug is unchanged', () => {
  const out = addReleaseSigning(TEMPLATE);
  expect(out).toContain('storeFile file(HISAAB_STORE_FILE)');
  expect(out).toMatch(/release \{\s+if \(!project\.hasProperty\('HISAAB_STORE_FILE'\)\)/);
  expect(out).toMatch(/throw new GradleException[\s\S]*signingConfig signingConfigs\.release/);
  expect(out).toMatch(/debug \{\s+signingConfig signingConfigs\.debug/);
  expect(addReleaseSigning(out)).toBe(out);
});

test('fails loudly if the template changes', () => {
  expect(() => addReleaseSigning('android { }')).toThrow(/template changed/);
});
