# Release Checklist

Status: Approved · Last updated: 2026-10-21

Copy this list into the phase report for every APK given to anyone.

## Before building

- [ ] All Phase acceptance criteria for included features verified.
- [ ] `npm run typecheck`, `npm run lint`, `npm test` pass (output attached).
- [ ] `version` and `android.versionCode` bumped; versionCode > last distributed.
- [ ] CHANGELOG.md updated with version, versionCode, date, changes.
- [ ] Application ID is `com.shivambgs15.hisaab` (Q1) — never changed between releases.
- [ ] No debug flags, developer screen, or test data generators in release variant.
- [ ] No `console.log` with personal data.

## Build

- [ ] `APP_VARIANT=release`; built with the **release keystore** (BUILD_AND_RELEASE.md).
- [ ] APK named `hisaab-<version>-vc<versionCode>.apk`.

## Verify the APK

- [ ] Certificate SHA-256 matches the recorded release key fingerprint.
- [ ] Permissions list reviewed: only CAMERA, POST_NOTIFICATIONS, biometric, and library-required ones; **no INTERNET** (or documented exception).
- [ ] `allowBackup=false`.
- [ ] Fresh install on emulator → onboarding → add expense with receipt → udhaar entry → backup → restore → all OK.
- [ ] Airplane mode: all of the above still work.
- [ ] Install **over** the previous version on a phone with data → data and receipts intact.
- [ ] App lock works on the release build.
- [ ] Notification fires on the release build.

## Distribute

- [ ] Upload APK to Google Drive; link set to "anyone with the link" only for the people it's sent to.
- [ ] Send the friend install guide (BUILD_AND_RELEASE.md §4).
- [ ] Remind everyone: separate data per phone; make backups; don't uninstall to update.

## After release

- [ ] Keystore backups still present in both places.
- [ ] Note any friend-reported issues as defects with priority.
