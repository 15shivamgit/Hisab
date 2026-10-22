# Phase Report — Phase 2: Project setup

Date: 2026-10-21 (code) · 2026-10-22 (device checks) · Branch: `main` (no phase branches — owner decision)

**Status: all acceptance criteria verified — awaiting owner approval.** The Android toolchain was installed on 2026-10-22; the dev build ran on the owner's phone and the release-variant APK was built and inspected.

## 1. What was implemented

- Expo **SDK 58** app (latest stable, `expo` 58.0.16) created from the default template and merged into the repo next to `docs/`. Template demo code, Expo branding assets, web/iOS-only packages, LICENSE, and reset script removed.
- TypeScript strict (+ `noUncheckedIndexedAccess`), `@/*` → `src/*` alias.
- ESLint 9 flat config (`eslint-config-expo` + `eslint-config-prettier`), Prettier (`.prettierrc`, `.prettierignore`), `.gitattributes` (LF).
- Jest 30 + `jest-expo` + React Native Testing Library 14. Scripts: `typecheck`, `lint` (ESLint + `prettier --check`), `format`, `test`, `test:watch`, `test:coverage`, `start` (dev client), `android`.
- `app.config.ts` per APP_CONFIG.md: dev/release variants (`com.shivambgs15.hisaab.dev` "Hisaab Dev" / `com.shivambgs15.hisaab` "Hisaab"), `allowBackup: false` (ADR-010), blocked permissions incl. INTERNET in release (ADR-012), `permissions: []`, versionCode 1, adaptive + monochrome icon, splash.
- App icon rendered from the approved concept: `icon.png`, `adaptive-icon-foreground.png`, `adaptive-icon-monochrome.png`, `splash-icon.png`.
- Theme: `src/theme/tokens.ts` (DESIGN_TOKENS.md, sky blue) and `ThemeProvider` with `system | light | dark` preference (SET-01 groundwork); Expo Router navigation theme follows it.
- Base components: `AppText`, `Screen`, `Button` (primary/secondary/ghost/danger, 48 dp, loading/busy), `Card`, `EmptyState`, `PlaceholderScreen`.
- Native bottom tabs: Home · Transactions · Udhaar · Reports · More with placeholder content; strings in `src/content/strings.ts`.
- Root `CLAUDE.md` also imports `AGENTS.md` (Expo's "check versioned docs" rule).

## 2. Files created or changed

| File | Change |
|---|---|
| `package.json`, `package-lock.json` | New — SDK 58 deps, dev tools, scripts, Jest preset |
| `app.config.ts` | New — variants, IDs, permissions, icons, splash |
| `tsconfig.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.gitattributes`, `.gitignore` | New / merged |
| `AGENTS.md`, `.vscode/`, `.claude/settings.json` | From the Expo template |
| `assets/images/*.png` | New — app icon set |
| `src/app/_layout.tsx`, `src/app/(tabs)/*.tsx` | New — root stack, native tabs, 5 placeholder screens |
| `src/theme/tokens.ts`, `src/theme/ThemeProvider.tsx` | New |
| `src/components/{AppText,Screen,Button,Card,EmptyState,PlaceholderScreen}.tsx` | New |
| `src/content/strings.ts` | New |
| `src/theme/tokens.test.ts`, `src/theme/ThemeProvider.test.tsx`, `src/components/Button.test.tsx` | New tests |
| `CLAUDE.md` | Adds `@AGENTS.md` |
| docs: TECH_STACK, PROJECT_STRUCTURE, DESIGN_TOKENS, APP_CONFIG, ENVIRONMENT_SETUP, WORKFLOW, DEVELOPMENT_PHASES, PROJECT_CONTEXT, CHANGELOG | Updated to match |

## 3. Commands and tests actually executed

```
npm run typecheck        → passed (tsc --noEmit, no errors)
npm run lint             → passed (expo lint: no problems; prettier: "All matched files use Prettier code style!")
npm test                 → 3 suites passed, 40 tests passed
npx expo-doctor          → 20/20 checks passed
npx expo install --check → Dependencies are up to date
npx expo export --platform android → Android Hermes bundle 2.6 MB; MaterialSymbols_400Regular.ttf bundled as a local asset
APP_VARIANT=release npx expo prebuild --platform android --no-install --clean → manifest inspected (below); android/ deleted afterwards
npx expo prebuild --platform android --no-install --clean (dev)               → manifest inspected; android/ deleted afterwards
```

The first `npm test` run **failed** one case: dark `primary` on dark `primarySoft` (`#0C4A6E`) was 4.42:1, below 4.5:1. `primarySoft` (dark) was changed to `#082F49`; the re-run passed.

### Device checks (2026-10-22)

Phone: **vivo V2205, Android 14 (API 34), arm64-v8a**, USB debugging.

```
adb devices -l                         → 10BC9X13EW000AP device model:V2205
npx expo run:android --no-bundler      → attempts 1–2 FAILED: Gradle wrapper download timed out (10 s)
                                          (one release-assets.githubusercontent.com IPv4 address unreachable from this ISP)
                                       → attempt 3 FAILED: Maven Central "Connection reset" on react-android-0.88.0-debug.aar
                                       → attempt 4 FAILED: ninja "Filename longer than 260 characters" (C++ codegen)
                                       → attempt 5: BUILD SUCCESSFUL in 8m 4s; installed com.shivambgs15.hisaab.dev
npx expo start --dev-client + adb reverse tcp:8081 tcp:8081
                                       → "Android Bundled 26474ms ... (1318 modules)"; app opened on the phone
adb screencap (Home, Udhaar; phone in dark mode, then `cmd uimode night no`, then restored to `yes`)
APP_VARIANT=release expo prebuild + gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
                                       → BUILD SUCCESSFUL in 27m 24s; app-release.apk 42.8 MB (debug-signed, not installed)
aapt dump badging / xmltree, apksigner verify → results in section 4
```

Fixes applied to the machine (not the repo) — details in ENVIRONMENT_SETUP.md: Gradle 9.4.1 zip downloaded with PowerShell into the wrapper cache (SHA-256 matched the official checksum); `~/.gradle/gradle.properties` with longer HTTP timeouts, 10 retries, and IPv4 preference; Windows `LongPathsEnabled = 1`; CMake 3.22.1's `ninja.exe` replaced by ninja 1.12.1 from SDK `cmake/3.31.6` (old one kept as `ninja-1.10.2.exe.bak`).

## 4. Test results

| Check | Result | Evidence |
|---|---|---|
| Typecheck / lint / unit + component tests | ✅ | Section 3 |
| Text contrast ≥ 4.5:1 for 16 colour pairs in both themes | ✅ | `tokens.test.ts` |
| Release manifest: `allowBackup="false"`, INTERNET removed, ID `com.shivambgs15.hisaab`, versionCode 1 | ✅ | prebuild output |
| Dev manifest: ID `.dev`, "Hisaab Dev", INTERNET present, scheme `hisaab-dev` | ✅ | prebuild output |
| App icon renders correctly (full, adaptive, monochrome) | ✅ | rendered PNGs inspected |
| Dev build runs on a real phone | ✅ | vivo V2205, Android 14; `Hisaab Dev` opened, Home tab rendered |
| Tabs navigate | ✅ | Tapped Udhaar → Udhaar screen, indicator moved (screenshot) |
| Light/dark follows system | ✅ | Phone dark → dark theme; phone switched to light → light theme (screenshots); phone setting restored |
| Tab icons render offline from the bundled Material Symbols font | ✅ | All 5 icons visible |
| Release-variant APK builds once | ✅ | `app-release.apk` 42.8 MB, `arm64-v8a` + `armeabi-v7a` |
| Release APK: ID / version | ✅ | `com.shivambgs15.hisaab`, versionCode 1, versionName 1.0.0, minSdk 24, targetSdk 36, label "Hisaab" |
| Release APK merged permissions | ✅ | Only `VIBRATE` and `com.shivambgs15.hisaab.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (AndroidX, app-private). **No INTERNET** |
| Release APK `allowBackup` | ✅ | `android:allowBackup=0x0` |
| Smaller-APK ABI flag (BUILD_AND_RELEASE.md) | ✅ | `-PreactNativeArchitectures=arm64-v8a,armeabi-v7a` works |

## 5. Known issues and risks

| ID | Priority | Description | Plan |
|---|---|---|---|
| P2-1 | P2 | No Android toolchain → app not yet seen running on a device | **Resolved 2026-10-22:** toolchain installed, dev build verified on the phone, release APK built |
| P2-6 | P3 | This ISP drops some CDN connections (one GitHub asset IP unreachable; Maven Central resets). First native builds needed retries | Machine-level Gradle retry/timeout settings in place; if a new dependency download fails, re-run the build before investigating |
| P2-7 | P3 | ninja replaced by hand inside the SDK's CMake 3.22.1 | If Android Studio/SDK updates CMake 3.22.1, re-copy ninja 1.12.1 (ENVIRONMENT_SETUP.md) |
| P2-8 | P3 | Release build takes ~27 min on this machine (HDD project + two ABIs) | Acceptable for occasional releases; dev builds are ~8 min and only needed when native deps change |
| P2-2 | — | `expo-symbols` added without prior approval (tab icons; MIT; bundled font ~1 MB; offline verified) | **Resolved 2026-10-21:** owner approved (Option A) |
| P2-3 | — | `@expo/vector-icons` is deprecated; DEFAULT_CATEGORIES.md used MaterialCommunityIcons names | **Resolved 2026-10-21:** Option A — Material Symbols via `expo-symbols`; category icons renamed and checked against the symbol list |
| P2-4 | P3 | `npm audit` reports advisories in transitive dev/tooling dependencies of the template | Review after the device build; don't run `npm audit fix --force` (it can break SDK pins) |
| P2-5 | P3 | `KeyboardAvoidingView behavior="padding"` in `Screen` is untested on device (edge-to-edge Android) | Verify with the first form in Phase 4 |

## 6. Documentation updated

TECH_STACK (pinned versions, findings), PROJECT_STRUCTURE (`src/app/`), DESIGN_TOKENS (`primarySoft`, `onDanger`, icons), APP_CONFIG (verified keys, prebuild results), ENVIRONMENT_SETUP (machine status, commands), WORKFLOW (single `main` branch, pushing as `15shivamgit`), DEVELOPMENT_PHASES, PROJECT_CONTEXT, CHANGELOG.

## 7. Exact next steps

1. Owner reviews this report and approves Phase 2.
2. Phase 3 (database foundation): install `expo-sqlite` and `better-sqlite3` (already approved in TECH_STACK.md; `Verify:` better-sqlite3 prebuilt binary for Node 24 on Windows); `DbClient`, migrations, repositories, `src/lib` money/dates, seed with the Material Symbols category icons.
3. Phase 3 adds a native module (`expo-sqlite`), so one new dev build (~8 min) will be needed.

## Owner approval

- [ ] Approved to start Phase 3 — (owner, date)
