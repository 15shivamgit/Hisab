# Tech Stack

Status: Approved (versions pinned in Phase 2) · Last updated: 2026-10-21

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
| Pinch-zoom image component | Receipt viewer | **Own component** `src/features/receipts/components/ZoomableImage.tsx` on gesture-handler + reanimated (no extra library). `react-native-zoom-toolkit` was approved and tried first but failed on the phone (see Phase 5 findings). |

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

Expo **SDK 58** (`expo` 58.0.16, latest stable; SDK 58.0.0 released 2026-09-29). Installed with `npx expo install`; `npx expo-doctor` 20/20 checks pass. Patch updates applied by `npx expo install` in Phase 5 are shown in the table.

| Package | Version | Notes |
|---|---|---|
| expo | 58.0.17 | Phase 5 patch update (was 58.0.16) |
| react-native | 0.88.0 | New Architecture, edge-to-edge |
| react | 19.3.0 | |
| expo-router | 58.0.25 | Routes live in `src/app/` (SDK 58 template convention) |
| expo-dev-client | 58.0.14 | |
| expo-splash-screen | 58.0.11 | |
| expo-status-bar | 58.0.4 | |
| expo-system-ui | 58.0.6 | Required for `userInterfaceStyle` on Android |
| expo-constants, expo-linking | 58.0.12, 58.0.14 | expo-router peers |
| expo-image-picker | 58.0.10 | Phase 5. Camera + Android photo picker; config plugin sets the camera text and `microphonePermission: false` |
| expo-image-manipulator | 58.0.15 | Phase 5. `ImageManipulator.manipulate(uri).resize()` → `renderAsync()` → `saveAsync({ compress: 0.7, format: JPEG })` |
| expo-symbols | 58.0.4 | All app icons (Material Symbols). Approved by owner 2026-10-21 (Option A) |
| expo-font | 58.0.9 | Peer of expo-symbols (already part of `expo`) |
| react-native-gesture-handler | 3.3.0 | |
| react-native-reanimated / react-native-worklets | 4.7.1 / 0.13.0 | |
| react-native-safe-area-context | 5.10.1 | |
| react-native-screens | 4.30.0 | |
| expo-sqlite | 58.0.13 | Phase 3. One connection, serialized by `createDbClient` (ADR-017) |
| expo-crypto | 58.0.7 | Phase 3. `randomUUID()` (sync) for IDs |
| expo-file-system | 58.0.10 | Phase 3. New `File`/`Directory`/`Paths` API (the legacy API lives at `expo-file-system/legacy`; not used) |
| zod | 4.6.7 | Phase 3. Settings validation; Phase 4 form schema |
| react-hook-form | 7.90.0 | Phase 4. Transaction form |
| @hookform/resolvers | 5.9.2 | Phase 4. `zodResolver` (supports zod 4). **Pinned to v5:** v6.0.0 failed to install (npm ERESOLVE on its optional `effect` peer) |
| @react-native-community/datetimepicker | 9.2.1 | Phase 4. `DateTimePickerAndroid.open` (imperative Android dialog) |
| better-sqlite3 / @types/better-sqlite3 (dev) | 13.0.3 / 9.6.0 | Phase 3. Prebuilt binary loads on Windows with Node 24 (SQLite 3.53.4) — `Verify:` done 2026-10-22 |
| typescript | 6.0.3 | `strict` + `noUncheckedIndexedAccess` |
| jest / jest-expo / @types/jest | 30.5.2 / 58.0.12 / 30.0.0 | SDK 58 requires Jest 30 |
| @testing-library/react-native | 14.1.0 | v14: `render` and `fireEvent.*` are async (`await`) |
| eslint / eslint-config-expo | 9.39.5 / 58.0.4 | Flat config `eslint.config.js` |
| prettier / eslint-config-prettier | 3.9.10 / 10.1.8 | `eslint-plugin-prettier` not used; `npm run lint` runs `prettier --check` |

### Phase 2 findings

- **`@expo/vector-icons` is deprecated** in current Expo docs (migration to `@react-native-vector-icons/*`). It is not installed. DESIGN_TOKENS.md § Icons is updated.
- **Tab icons use `expo-symbols`** (Material Symbols via native tabs' `md` prop). Checked: the font `MaterialSymbols_400Regular.ttf` (972 KB, from `@expo-google-fonts/material-symbols`, MIT/Apache-2.0) is bundled into the app as a local asset — no network. Only the regular weight is imported. Licence of expo-symbols: MIT. Owner approved it on 2026-10-21 and chose it for category icons too (Option A).
- Removed from the template (web/iOS-only or unused): `@expo/ui`, `expo-device`, `expo-glass-effect`, `expo-web-browser`, `expo-image`, `react-dom`, `react-native-web`.
- Windows: `npx expo install <pkg> -- --dev` needs the `--` quoted in PowerShell (`"--"`), otherwise packages land in `dependencies`.

### Phase 5 findings (2026-10-23)

- **`react-native-zoom-toolkit` 5.1.1 removed.** It was approved by the owner, but on the phone (gesture-handler 3.3 + Reanimated 4.7) the pinch zoom snapped back to 1× as soon as the fingers lifted, and double-tap zoomed for a moment and then reset. Replaced by our own `ZoomableImage` (pinch 1×–5× that stays, double-tap 2.5× toggle, one-finger pan only while zoomed and clamped to the image edges). The maths is in `zoomMath.ts` with unit tests. Owner checked it on the phone.
- gesture-handler 3.3 still exports the `Gesture` / `GestureDetector` builder API used by `ZoomableImage`. Shared values use `.get()` / `.set()` because the React Compiler lint rule (`react-hooks/immutability`) rejects `.value =` assignments.
- `expo-image-manipulator` re-encoding **applies the EXIF orientation and strips EXIF/GPS** (checked on the phone with a 4000×3000 test JPEG stored sideways with EXIF Orientation 6 and a fake GPS tag: the saved receipt was upright, 1200×1600, 51 KB, no EXIF segment).
