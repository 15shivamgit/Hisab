# Phase Report — Phase 10: QA and hardening

Date: 2026-10-30 · Branch: `main`

**Status: done, with three checks left for the owner's phone (§ 5) — awaiting owner approval.**

## 1. What was done

- **E2E (Maestro):**
  - Maestro CLI 2.11.0 installed (Apache-2.0, free, analytics off with `MAESTRO_CLI_NO_ANALYTICS=1`; owner approved).
  - Five journeys in `e2e/`: `add-expense`, `filters`, `udhaar`, `budget`, `persistence`, plus `common/` subflows (fresh start through onboarding, add expense, dismiss emulator ANR).
  - Run on a release-type build (dev package, bundled JS, debug-signed, x86_64) with the emulator in **airplane mode**.
- **Device matrix (emulators; owner approved the images):**
  - Android 17 (`Medium_Phone_API_37.0`).
  - **Android 8.0** (`Hisaab_API26_Min`, 2 GB) — the new minimum.
  - Android 7.0 (`Hisaab_API24_LowEnd`, 2 GB) — where the crash was found.
  - Android 13 (`Hisaab_API33`) — too slow on this PC to use (§ 5).
- **Minimum Android 8.0 (NFR-04):** Expo's docs say SDK 58 runs on "Android 7+", but on Android 7.0 both release and debug builds crash at start (`java.nio.file.Path` in expo-modules-core, `java.time.Duration` in the dev launcher — Android 8 classes). Owner decision: minSdk 26 via `plugins/withMinSdk.js` (no new dependency). The built APK reports `minSdkVersion: 26`.
- **Bugs found and fixed:**
  - **D1:** Save hidden behind the keyboard on full-screen forms (expense, person, udhaar entry). Cause: React Native's `KeyboardAvoidingView` compares its layout `y` (relative to the parent, below the native header) with the keyboard's window position, so it under-pads by the header height. Fix: new `KeyboardAvoider` measures its own window position (`measureInWindow`) and passes it as `keyboardVerticalOffset`. Seen and fixed on Android 17.
  - **D2:** Save under the 3-button navigation bar on Android 8, so taps on it went to the system. The app draws edge-to-edge and the form footers ignored the bottom inset. Fix: new `FormFooter` adds `insets.bottom`; used by all three forms.
  - **D3:** Donut centre label overflowed the ring at 200 % font. It now shrinks to fit like the amount below it.
- **Security review:** the checklist in SECURITY_AND_PRIVACY.md is filled. In short:
  - SQL is fully parameterised; receipt paths are checked three times.
  - No network APIs, `console`, or `eval`.
  - Merged manifest reviewed: `allowBackup=false`; the only exported components are `MainActivity` plus two receivers guarded by system permissions.
  - Dev tools are inert in release.
  - `npm audit`: 4 high and 12 low advisories, all in build/CLI tooling, none in the app bundle. `npm audit fix --force` would downgrade Expo to 51.
- **Accessibility:**
  - Font 200 %: amounts and buttons are never clipped.
  - Accessibility tree of the add-expense form: every control has a label and role, and selected chips report `checked`.
- **Performance:** 5,000 entries + 300 receipts seeded on the emulator (dev tools, 36.9 s).
  - Queries on the PC with 5,000 rows: dashboard 4–7 ms, month report 1–2 ms, list ~1 ms.
  - Emulator cold start to a loaded dashboard: 6.1–7.1 s (pixel probe, ~0.75 s resolution). Activity launch alone takes 3.6 s on this emulator, so the time is emulator start-up, not data.
- **Coverage goals (TESTING_STRATEGY.md):**
  - `money`, `dates`, `balance`, `budget`: 100 % lines and branches.
  - All repositories ≥ 90 % lines.
  - Total: 89 % lines, 77 % branches.
  - New tests: `datesFormat.test.ts`, repository error paths, `paiseToRupeeString` guard.
- **Also checked:**
  - Android 8: app lock via the device PIN screen, secure flag (screenshot 0 bytes), cold-start unlock.
  - Android 8: removing the phone's screen lock turns app lock off with the notice.
  - Release build: changing system font/theme causes no crash or error (P8-2).

## 2. Files created or changed

| File | Change |
|---|---|
| `e2e/*.yaml`, `e2e/common/*.yaml` | Five Maestro journeys + subflows |
| `plugins/withMinSdk.js`, `app.config.ts` | minSdk 26 |
| `src/components/KeyboardAvoider.tsx` | New; used by `Screen`, transaction editor, person form, udhaar entry |
| `src/components/FormFooter.tsx` | New; used by transaction form, person form, udhaar entry |
| `src/components/charts/DonutChart.tsx` | Centre label fits |
| `src/lib/datesFormat.test.ts`, `src/lib/money.test.ts`, `src/db/repositories/errorPaths.repo.test.ts` | Coverage gaps |
| Docs | NON_FUNCTIONAL (NFR-04), APP_CONFIG, TECH_STACK, ENVIRONMENT_SETUP, TESTING_STRATEGY, ACCEPTANCE_CRITERIA (device matrix), SECURITY_AND_PRIVACY (checklist), UI_UX_GUIDE (forms), DEVELOPMENT_PHASES, PROJECT_CONTEXT, CHANGELOG |

## 3. Commands and tests actually executed

```
npx tsc --noEmit    → exit 0
npm run lint        → exit 0
npx jest            → 41 suites, 446 passed, 0 failed
npx jest --coverage → goal files listed in § 1
gradlew assembleRelease -PreactNativeArchitectures=x86_64 (dev variant) → BUILD SUCCESSFUL (several times)
aapt2 dump badging app-release.apk → minSdkVersion '26', targetSdkVersion '36'
maestro test e2e/<flow>.yaml (each flow, emulator in airplane mode)
npm audit --omit=dev; npm ls --all (no missing/invalid packages)
```

## 4. Test results

| Check | Result | Evidence |
|---|---|---|
| Unit/repo/component tests | ✅ | 446/446 |
| E2E: 5 journeys on Android 17, offline | ✅ | add-expense 183 s, filters 301 s, udhaar 175 s, budget 160 s, persistence 172 s |
| E2E: 5 journeys on Android 8.0, offline (after D1/D2 fixes) | ✅ | 117 / 144 / 98 / 99 / 110 s |
| AC-09, AC-13 (E) | ✅ | `udhaar.yaml`: "You will get ₹7,000"; flip warning on got 8,000 |
| AC-01 persistence (E) | ✅ | `persistence.yaml`: entry after stop + relaunch |
| Android 7.0 | ❌ → minSdk 26 | Crash log (expo-modules-core, dev launcher); APK now refuses Android 7 |
| AC-22 airplane mode | ✅ emulator + phone | Emulators: all journeys with "Active default network: none". Owner's phone (2026-10-30, airplane mode on): all five journeys pass on **Hisaab QA** (copies of the flows retargeted to `com.shivambgs15.hisaab.qa`; a USB drop interrupted `filters` once, the rerun passed); Reports opens; Create backup and Export CSV open the share sheet (closed with Back, nothing sent) |
| AC-26 font 200 % | ✅ with P3 | Screenshots: dashboard, form, transactions |
| AC-27 TalkBack | ✅ tree / ⏭ gestures | Labels, roles, and states audited; a real TalkBack walkthrough is left for the owner (optional) |
| AC-28 5,000 entries < 2 s on a mid-range phone | ✅ accepted by owner (2026-10-30): ~2.1 s cold start, not data | Owner's phone, Hisaab QA (release-type build), cold start → dashboard loaded, 6 runs each, pixel probe ~0.25 s: **5,000 entries 2.00–2.28 s**, **20 entries 2.00–2.36 s** (same full dashboard), empty app (welcome card) 1.69–1.78 s. Activity launch alone: 0.85 s. 5,000 entries add no measurable time; the full dashboard's cold start sits right at the 2 s line. Warm return is instant. Owner to decide (§ 7) |
| P9-1 (before Android 14) | ✅ | Android 8: lock, secure flag, unlock, auto-off |
| Security checklist | ✅ | SECURITY_AND_PRIVACY.md |
| Coverage goals | ✅ | 100 % for the four libs; repositories ≥ 90 % |

## 5. Known issues and risks

| ID | Priority | Description | Plan |
|---|---|---|---|
| P10-1 | P3 | At font 200 %, tab labels truncate ("Trans…", "Repo…"), long category names truncate, and the + button can cover the last row (it scrolls) | Accept |
| P10-2 | P3 | Changing the system font size while Hisaab is open recreates the screen: navigation goes back to the dashboard and an unsaved form is lost (theme changes don't). No crash in release (was P8-2) | Accept |
| P10-5 | P2 → fixed | Typed confirmations (Restore, Delete all data): the keyboard covered Cancel/Restore/Delete, and Back closes the dialog, so the only way on was the keyboard's ✓ key. Found on the phone while restoring into Hisaab QA. Fix: `KeyboardAvoidingView` inside the dialog's Modal. Verified on the phone with "Delete all data?" typing only "DEL" (confirm stays disabled), then Cancel — data unchanged | Done |
| P10-3 | Info | The emulators on this PC are slow (12 GB RAM shared with other projects); "System UI isn't responding" appears when Maestro starts, and the Android 13 emulator was unusable. The app itself ran 60 s without an ANR | Use airplane mode + `dismiss-anr.yaml` |
| P10-4 | ✅ Closed | D1/D2 verified on the owner's phone too (vivo V2205, Android 14, dev build reloaded via Metro, 2026-10-30): with the keyboard open, Save sits right above it on the expense, add person, and udhaar entry forms; without the keyboard, Save sits above the gesture bar. Nothing saved; forms discarded | Done |
| P9-2 | P3 | With a lock timeout other than "Immediately", content can show briefly before the cover | Accept |
| P7-1 | P3 | Release manifest still has launcher-badge / install-referrer permissions | Phase 11 |
| — | Info | During this phase a mistyped doc-edit command made bash start `npm audit fix --force`; it failed (file locked by Gradle) and npm rolled back — `npm ls` shows no changes. Process fixed (scripts are now written to files) | Done |

## 6. Documentation updated

See § 2 (docs row).

## 7. Exact next steps

1. ~~Keyboard fix on the phone (P10-4)~~ — done. ~~Airplane mode on the phone (AC-22)~~ — done. ~~AC-28 on the phone~~ — measured (~2.1 s cold start, independent of data size).
   - Method: a separate **Hisaab QA** app (APP_VARIANT=qa, own package, release-type, debug-signed) installed next to the owner's apps; a 5,000-entry `.hisaab` was generated on the PC with the app's own backup code and restored in Hisaab QA. Afterwards Hisaab QA, the test backups, and the probe files were removed; airplane mode is off; the owner's Hisaab and Hisaab Dev data were never touched.
2. Owner approves Phase 10.
3. Owner decides whether ~2.1 s cold start is acceptable for AC-28 or Phase 11 should try to shorten app start-up.
4. Phase 11: release APK — Expo patch update (re-run `npm audit`), P7-1 permissions, AC-28 timing on the phone, install-over-old-version (AC-30), friend distribution.

## Owner approval

- [x] Approved to start Phase 11 — owner, 2026-10-30
