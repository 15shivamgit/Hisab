# Phase Report — Phase 2: Project setup

Date: 2026-10-21 · Branch: `main` (no phase branches — owner decision)

**Status: code complete, device checks blocked.** Android Studio, the Android SDK, and a JDK are not installed on the owner's machine, so the dev build and the release-variant APK could not be built yet.

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

## 4. Test results

| Check | Result | Evidence |
|---|---|---|
| Typecheck / lint / unit + component tests | ✅ | Section 3 |
| Text contrast ≥ 4.5:1 for 16 colour pairs in both themes | ✅ | `tokens.test.ts` |
| Release manifest: `allowBackup="false"`, INTERNET removed, ID `com.shivambgs15.hisaab`, versionCode 1 | ✅ | prebuild output |
| Dev manifest: ID `.dev`, "Hisaab Dev", INTERNET present, scheme `hisaab-dev` | ✅ | prebuild output |
| App icon renders correctly (full, adaptive, monochrome) | ✅ | rendered PNGs inspected |
| Dev build runs on a real phone; tabs navigate; light/dark follows system | ❌ not run | Android Studio not installed |
| Release-variant APK builds once | ❌ not run | Android Studio not installed |
| Merged manifest permissions (library AARs) | ❌ not run | needs a Gradle build |

## 5. Known issues and risks

| ID | Priority | Description | Plan |
|---|---|---|---|
| P2-1 | P2 | No Android toolchain → app not yet seen running on a device | Owner installs Android Studio (ENVIRONMENT_SETUP.md), then the two device checks are run before Phase 2 is closed |
| P2-2 | — | `expo-symbols` added without prior approval (tab icons; MIT; bundled font ~1 MB; offline verified) | Owner approves, or tab icons switch to PNGs via `src` |
| P2-3 | — | `@expo/vector-icons` is deprecated; DEFAULT_CATEGORIES.md uses MaterialCommunityIcons names | Owner picks the category icon library before Phase 3 |
| P2-4 | P3 | `npm audit` reports advisories in transitive dev/tooling dependencies of the template | Review after the device build; don't run `npm audit fix --force` (it can break SDK pins) |
| P2-5 | P3 | `KeyboardAvoidingView behavior="padding"` in `Screen` is untested on device (edge-to-edge Android) | Verify with the first form in Phase 4 |

## 6. Documentation updated

TECH_STACK (pinned versions, findings), PROJECT_STRUCTURE (`src/app/`), DESIGN_TOKENS (`primarySoft`, `onDanger`, icons), APP_CONFIG (verified keys, prebuild results), ENVIRONMENT_SETUP (machine status, commands), WORKFLOW (single `main` branch, pushing as `15shivamgit`), DEVELOPMENT_PHASES, PROJECT_CONTEXT, CHANGELOG.

## 7. Exact next steps

1. Owner: install **Android Studio** (includes SDK + JDK `jbr`), set `ANDROID_HOME` / `JAVA_HOME` / PATH as in ENVIRONMENT_SETUP.md, create one emulator, enable USB debugging on the phone.
2. Run `npm run android` → dev build on emulator and phone; check tabs and light/dark.
3. Build the release-variant APK once (BUILD_AND_RELEASE.md Option A, debug-signed is fine) and run `aapt dump permissions`.
4. Owner decisions: approve `expo-symbols`; choose the category icon library.
5. Close Phase 2 → start Phase 3 (database foundation).

## Owner approval

- [ ] Approved to start Phase 3 — (owner, date)
