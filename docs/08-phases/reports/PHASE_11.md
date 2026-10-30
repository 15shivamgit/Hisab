# Phase Report — Phase 11: Release APK and friend distribution

Date: 2026-10-30 · Branch: `main`

**Status: release 1.1.0 (versionCode 2) built, verified, and installed over 1.0.0 on the owner's phone with data intact. Distribution to friends is the owner's step (§ 7).**

## 1. What was done

- **Owner decisions (2026-10-30):**
  - AC-28 accepted: cold start ~2.1 s, the same with 20 or 5,000 entries.
  - Expo patch update approved.
  - Launcher-badge and install-referrer permissions blocked (P7-1).
  - Version 1.1.0, versionCode 2.
- **Expo patch update:** expo 58.0.17 → 58.0.21, react-native 0.88.0 → 0.88.1, 13 more Expo packages, jest-expo 58.0.13 (`npx expo install --fix`; jest-expo then fixed by hand because the tool put it into `dependencies` as well).
  - `licenses.json` regenerated (the licence test caught it).
  - 446 tests pass.
  - `npm audit`: node-forge fixed; left are zod 3.25.76 inside `@expo/cli` and deepmerge (build time), none in the app.
- **P7-1:** 20 launcher-badge permissions (ShortcutBadger) and `BIND_GET_INSTALL_REFERRER_SERVICE` added to `blockedPermissions`. Reminders still fire (checked below).
- **Release APK:** `D:\Code\hisaab-releases\hisaab-1.1.0-vc2.apk` (55.1 MB, arm64-v8a + armeabi-v7a, signed with the owner's release key; SHA-256 of the file starts `1ae9aa3ec88310ad`).
- **Regression after the update (owner's phone, airplane mode, separate Hisaab QA app):**
  - All five E2E journeys pass (two infrastructure retries: a Maestro connection timeout, earlier a USB drop).
  - Reminder notification fired at the set time on `udhaar-reminders`.
  - App lock: enable with fingerprint, cold start shows "Unlock Hisaab" before any data, screenshot blocked (0 bytes), fingerprint unlocks.
  - Hisaab QA was uninstalled afterwards.
- **Update over 1.0.0 (AC-30)** on the owner's phone, owner had a backup:
  - `adb install -r` succeeded; versionCode 1 → 2, schema upgraded on first start, no crash.
  - Onboarding shown once (expected for existing installs).
  - Data identical: this month income ₹50,000 / expense ₹8,940, 4 entries, the ₹560 entry with its 3 receipts (no "Image missing").
- **Friend install guide** (BUILD_AND_RELEASE.md § 4): now says Android 8.0+ and "More → Backup & restore".

## 2. Release checklist (RELEASE_CHECKLIST.md) — 1.1.0 (vc2)

### Before building
- [x] Phase acceptance criteria for included features verified (Phases 1–10 reports).
- [x] `npm run typecheck`, `npm run lint`, `npm test` pass — 446/446.
- [x] `version` 1.1.0 and `android.versionCode` 2 (> last distributed 1).
- [x] CHANGELOG updated (Builds table).
- [x] Application ID `com.shivambgs15.hisaab` — unchanged.
- [x] No debug flags, developer screen, or test data generators in release (`/dev-tools` renders nothing; crash-test pause is `__DEV__` only).
- [x] No `console.*` in `src/`.

### Build
- [x] `APP_VARIANT=release`, release keystore (owner's `gradle.properties`; passwords never read).
- [x] Named `hisaab-1.1.0-vc2.apk`.

### Verify the APK
- [x] Certificate SHA-256 `d3d386b8…4418a` = recorded release key.
- [x] Permissions: CAMERA, POST_NOTIFICATIONS, USE_BIOMETRIC, USE_FINGERPRINT, VIBRATE, RECEIVE_BOOT_COMPLETED, DETECT_SCREEN_CAPTURE, ACCESS_NETWORK_STATE, WAKE_LOCK, app-private receiver permission. **No INTERNET.** (The last three come from the notifications library / WorkManager; DETECT_SCREEN_CAPTURE is required by expo-screen-capture on Android 14+.)
- [x] `allowBackup=false`.
- [x] Fresh install → onboarding → add expense → udhaar entry → backup → restore: covered by the E2E journeys and the 5,000-entry restore on Hisaab QA (same code, release build type). Adding a receipt photo was not repeated in this phase (camera is manual; checked in Phases 5, 9).
- [x] Airplane mode: all journeys pass offline (phone and emulators).
- [x] Install over the previous version on a phone with data → data and receipts intact.
- [x] App lock works on a release-type build (Hisaab QA).
- [x] Notification fires on a release-type build (Hisaab QA).

### Distribute (owner)
- [ ] Upload the APK to Google Drive; share the link only with the people it's sent to.
- [ ] Send the friend install guide.
- [ ] Remind everyone: separate data per phone; make backups; don't uninstall to update.

### After release (owner)
- [ ] Keystore backups still present in both places.
- [ ] Note friend-reported issues as defects.

## 3. Commands and tests actually executed

```
npx expo install --fix; npm install          → Dependencies are up to date
npx tsc --noEmit / npm run lint / npx jest   → exit 0 / exit 0 / 446 passed
npm audit --omit=dev                          → 15 (12 low, 3 high), all build/CLI tooling
build-release.ps1 (APP_VARIANT=release, assembleRelease arm64-v8a,armeabi-v7a) → BUILD SUCCESSFUL in 34m 20s
apksigner verify --print-certs; aapt2 dump badging / permissions / xmltree
build-qa.ps1 (APP_VARIANT=qa, arm64) → BUILD SUCCESSFUL; maestro (5 journeys, phone, airplane mode)
adb install -r hisaab-1.1.0-vc2.apk → Success (owner's phone, over 1.0.0)
```

## 4. Open points

| ID | Priority | Description | Plan |
|---|---|---|---|
| AC-31 | Check | Two phones keep separate data — needs a friend's phone | When the first friend installs |
| AC-27 | Optional | Real TalkBack walkthrough of adding an expense | Owner, any time |
| P10-1, P10-2, P9-2 | P3 | Accepted (see Phase 9/10 reports) | — |

## 5. Documentation updated

TECH_STACK (versions), SECURITY_AND_PRIVACY (audit, P7-1), BUILD_AND_RELEASE (friend guide), CHANGELOG (Builds), DEVELOPMENT_PHASES, PROJECT_CONTEXT, PHASE_10 (AC-28 accepted).

## 6. Note for the owner

`D:\Code\hisaab-releases\` now holds both APKs. Keep it; the keystore and its two backups remain the only way to publish updates that install over this version (ADR-014).

## 7. Exact next steps

1. Owner uploads `hisaab-1.1.0-vc2.apk` to Google Drive and shares it with friends together with the install guide (text in BUILD_AND_RELEASE.md § 4).
2. Owner confirms the two keystore backups are still in place.
3. When a friend installs: quick check that their data is separate (AC-31).
4. Owner approves Phase 11 (the app is then "v1 done"; later work is driven by friend feedback).

## Owner approval

- [x] Phase 11 complete — owner, 2026-10-30. Distribution to friends, the keystore-backup check, and AC-31 stay with the owner (§ 7).
