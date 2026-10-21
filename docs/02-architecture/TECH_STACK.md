# Tech Stack

Status: Approved (versions pinned in Phase 2; expo-symbols pending approval) · Last updated: 2026-10-21

All items are free and open-source. **`Verify:`** before Phase 2, check the latest stable Expo SDK, install every package with `npx expo install <pkg>` (which picks SDK-compatible versions), and record the exact installed versions in the table at the bottom.

## Runtime dependencies

| Package | Purpose | Notes |
|---|---|---|
| `expo` (latest stable SDK) | Framework | Use the default TypeScript template with Expo Router |
| `react-native`, `react` | UI runtime | Versions dictated by the SDK |
| `expo-router` | File-based navigation | Tabs + stack |
| `expo-dev-client` | Development build | Required: Expo Go is not used (ADR-001) |
| `expo-sqlite` | Local database | Use the async API and `withExclusiveTransactionAsync` for writes. `Verify:` exclusive transaction support on Android in the current SDK. |
| `expo-file-system` | Receipt files, backups, CSV | `Verify:` whether the current SDK's default API is the new `File`/`Directory`/`Paths` API or the legacy one; use the current one consistently. |
| `expo-image-picker` | Camera and gallery | Android photo picker needs no storage permission; camera needs CAMERA permission |
| `expo-image-manipulator` | Resize + JPEG compress receipts | |
| `expo-document-picker` | Pick a backup file for restore | |
| `expo-sharing` | Share backup and CSV files via the Android share sheet | Udhaar reminder text uses React Native's built-in `Share` API instead |
| `expo-crypto` | `randomUUID()` for IDs, SHA-256 for backup file checksums | |
| `expo-local-authentication` | App lock (biometric / device PIN) | |
| `expo-notifications` | Local udhaar reminders | Local only — no push, no Expo push service |
| `expo-screen-capture` | Hide content in app switcher when app lock is on | `Verify:` behaviour on current Android versions |
| `@react-native-community/datetimepicker` | Date picker | |
| `react-native-gesture-handler`, `react-native-reanimated` | Gestures, pinch-zoom on receipt viewer | Usually included with the Expo Router template |
| `react-hook-form`, `zod`, `@hookform/resolvers` | Forms and validation | Zod schemas also validate backup files |
| `date-fns` | Date ranges, formatting helpers | Tree-shakeable; only via `src/lib/dates.ts` |
| `fflate` | Create/read ZIP backup files in pure JS | Streaming API, no native code. Phase 6 spike must confirm memory use with 300 receipts (ADR-009). |
| `react-native-gifted-charts` + `react-native-svg` (+ its gradient peer dep) | Charts | `Verify:` current peer deps and Expo compatibility. Fallback: simple View-based bars. |
| Pinch-zoom image component | Receipt viewer | Choose in Phase 5 a small MIT library built on gesture-handler + reanimated, or implement a minimal one. Needs approval (CLAUDE.md rule 6). |

**Not used:** Zustand/Redux (ADR-013), SecureStore (ADR-011), any ORM (ADR-002), Sentry/Firebase/analytics (NFR-02), `expo-updates` (no OTA — it would need network).

## Development dependencies

| Package | Purpose |
|---|---|
| `typescript` (strict) | Type checking |
| `eslint` + `eslint-config-expo`, `prettier`, `eslint-config-prettier` | Lint and format |
| `@types/jest` | Jest types (TypeScript) |
| `jest`, `jest-expo` | Unit/component tests |
| `@testing-library/react-native` | Component tests |
| `better-sqlite3` + `@types/better-sqlite3` | Run real SQLite in Node for repository tests via the `DbClient` adapter. `Verify:` prebuilt binaries install on Windows for the Node version used. |
| Maestro CLI (installed separately, not npm) | E2E flows on emulator/device. `Verify:` Windows installation steps. Maestro Cloud is **not** used. |

## Tools

| Tool | Purpose |
|---|---|
| Node.js LTS | JS runtime |
| Android Studio + SDK + emulator | Dev builds, emulator, local Gradle release builds |
| JDK (version required by the SDK's Gradle) | Android builds |
| Git | Version control (repo initialised in Phase 2) |
| EAS CLI (Free plan, optional) | Cloud builds if local builds are inconvenient |

## Pinned versions (Phase 2, verified 2026-10-21)

Expo **SDK 58** (`expo` 58.0.16, latest stable; SDK 58.0.0 released 2026-09-29). Installed with `npx expo install`; `npx expo-doctor` 20/20 checks pass.

| Package | Version | Notes |
|---|---|---|
| expo | 58.0.16 | |
| react-native | 0.88.0 | New Architecture, edge-to-edge |
| react | 19.3.0 | |
| expo-router | 58.0.24 | Routes live in `src/app/` (SDK 58 template convention) |
| expo-dev-client | 58.0.14 | |
| expo-splash-screen | 58.0.10 | |
| expo-status-bar | 58.0.3 | |
| expo-system-ui | 58.0.6 | Required for `userInterfaceStyle` on Android |
| expo-constants, expo-linking | 58.0.12, 58.0.13 | expo-router peers |
| expo-symbols | 58.0.4 | **Added in Phase 2 — pending owner approval** (see below) |
| expo-font | 58.0.9 | Peer of expo-symbols (already part of `expo`) |
| react-native-gesture-handler | 3.3.0 | |
| react-native-reanimated / react-native-worklets | 4.7.1 / 0.13.0 | |
| react-native-safe-area-context | 5.10.1 | |
| react-native-screens | 4.30.0 | |
| typescript | 6.0.3 | `strict` + `noUncheckedIndexedAccess` |
| jest / jest-expo / @types/jest | 30.5.2 / 58.0.11 / 30.0.0 | SDK 58 requires Jest 30 |
| @testing-library/react-native | 14.1.0 | v14: `render` and `fireEvent.*` are async (`await`) |
| eslint / eslint-config-expo | 9.39.5 / 58.0.4 | Flat config `eslint.config.js` |
| prettier / eslint-config-prettier | 3.9.10 / 10.1.8 | `eslint-plugin-prettier` not used; `npm run lint` runs `prettier --check` |

### Phase 2 findings

- **`@expo/vector-icons` is deprecated** in current Expo docs (migration to `@react-native-vector-icons/*`). It is not installed. DESIGN_TOKENS.md § Icons is updated.
- **Tab icons use `expo-symbols`** (Material Symbols via native tabs' `md` prop). Checked: the font `MaterialSymbols_400Regular.ttf` (972 KB, from `@expo-google-fonts/material-symbols`, MIT/Apache-2.0) is bundled into the app as a local asset — no network. Only the regular weight is imported. Licence of expo-symbols: MIT. Fallback if not approved: PNG tab icons via the `src` prop.
- Removed from the template (web/iOS-only or unused): `@expo/ui`, `expo-device`, `expo-glass-effect`, `expo-web-browser`, `expo-image`, `react-dom`, `react-native-web`.
- Windows: `npx expo install <pkg> -- --dev` needs the `--` quoted in PowerShell (`"--"`), otherwise packages land in `dependencies`.
