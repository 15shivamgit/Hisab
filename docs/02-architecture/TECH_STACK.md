# Tech Stack

Status: Approved (versions to be pinned in Phase 2) · Last updated: 2026-10-21

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

## Pinned versions (fill in Phase 2)

| Package | Version | Verified on |
|---|---|---|
| expo | | |
| react-native | | |
| … | | |
