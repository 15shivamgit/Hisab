# Security and Privacy

Status: Approved · Last updated: 2026-10-21

## Privacy promise (shown in About and onboarding)

> Hisaab works completely offline. Your data is stored only on this phone. It is never uploaded anywhere. Backups and exports are files you create and control.

## Data inventory

| Data | Where | Leaves the phone? |
|---|---|---|
| Transactions, categories, budgets, settings | SQLite in app-private storage | Only inside backup/CSV files the user creates and shares |
| Receipt images | App-private `receipts/` | Only inside backup files |
| People (names, optional phone, notes), udhaar entries | SQLite | Only in backup/CSV, or the reminder text the user chooses to send |
| Error log (codes, versions, counts — no personal data) | App-private `diagnostics/errors.json` | Only when the user taps "Share diagnostic info" and sends it (share sheet; owner decision 2026-10-28) |

No data is collected by the developer. (Play Store data-safety answer, if ever needed: "No data collected, no data shared".)

## Threat model

| Threat | Mitigation |
|---|---|
| Someone picks up the unlocked phone | Optional app lock (ADR-011); lock after background timeout (default 60 s) |
| App switcher preview shows amounts | When app lock is on, the secure flag hides content in recents; this also blocks screenshots/screen recording of the app (accepted, ADR-016). `Verify:` behaviour |
| Unlocked app left on a system screen (camera, share sheet) | Lock suspension lasts at most 5 minutes (ADR-016) |
| Lost/stolen locked phone | Android file-based encryption protects app storage while the phone is locked. DB-level encryption (SQLCipher) is out of scope v1 |
| Backup file leaks (Drive, WhatsApp, Downloads) | Clear warning on backup screen: "Anyone with this file can read your data. Store it safely." Encrypted backups are a v2 candidate |
| Malicious or corrupted backup file | Treated as untrusted: size limits, path allowlist (no zip-slip), Zod schema validation, FK checks, checksums, staging before apply. See BACKUP_AND_RESTORE.md |
| Path traversal via stored paths | DB stores only `receipts/<uuid>.jpg`; every path is re-validated with a strict regex before file access |
| SQL injection | Parameterised queries only; no string-built SQL with user input (sort columns come from a fixed allowlist) |
| Data sent to third parties | No network code; release build without INTERNET permission (ADR-012); no analytics/crash SDKs |
| Sensitive data in logs | No `console.log` of amounts, names, notes in release; the error log and diagnostic report contain only versions, device model, counts, and error codes (test-enforced) |
| "Deleted" data left inside the app | Delete all data also removes the pre-restore safety backup and caches |
| Losing the release keystore | ADR-014 backup procedure |
| Lost data on uninstall | Onboarding + backup warnings + nudges (BAK-06, BAK-07) |

## Permissions

| Permission | When requested | If denied |
|---|---|---|
| CAMERA | First time the user taps "Take photo" | Explain, offer gallery, "Open settings" (checked on the phone in Phase 5: "Don't allow" → "Camera access is off" dialog → "Use gallery" opens the photo picker) |
| POST_NOTIFICATIONS (Android 13+) | First time a return-by date is set with reminders on | Date still saved; reminders shown in-app only (checked on the phone in Phase 7: "Notifications are off…" dialog with Open settings) |
| Biometric / device credential | When enabling app lock | Lock not enabled |
| Storage / media | **Not requested** (photo picker and document picker don't need it; gallery pick verified without it in Phase 5) | — |
| Contacts, SMS, location | **Never** | — |
| USE_BIOMETRIC (+ USE_FINGERPRINT for Android ≤ 8) | Install time; the system prompt appears when unlocking | App lock unavailable (Phase 9, expo-local-authentication) |
| DETECT_SCREEN_CAPTURE (Android 14+) | Install time, no prompt; normal permission | Needed: expo-screen-capture crashes on load without it. Gives no access to images (Phase 9) |
| INTERNET | Dev builds only; blocked in release (verified in the Phase 2 release APK) | — |
| VIBRATE | Install time, no prompt (Expo template) | — |
| `<applicationId>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | Added by AndroidX; app-private signature permission, no prompt | — |
| Added by `expo-notifications` (e.g. RECEIVE_BOOT_COMPLETED, VIBRATE) | Install time, no prompt | — . Keeps scheduled reminders after reboot. `Verify:` exact list in Phase 11. Phase 7 dev build: RECEIVE_BOOT_COMPLETED, WAKE_LOCK, ACCESS_NETWORK_STATE (Firebase/WorkManager) and `c2dm.permission.RECEIVE` (Firebase push — **blocked** in release) |
| SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM | **Not used** — reminders use inexact date triggers; a few minutes' delay is acceptable | — |

`Verify:` in Phase 11, list the final merged manifest permissions and confirm no unexpected ones (some libraries add permissions automatically; remove with `blockedPermissions` if unneeded).

## Secure coding checklist (used in Phase 10 review)

- [x] All SQL parameterised; dynamic `ORDER BY` from allowlist only — Phase 10: every interpolated SQL piece is a constant, a `?` placeholder list, the `SORT_SQL` map, or (backup restore) a column list from the constant `BACKUP_TABLES`; values are always bound
- [x] Every file path built from IDs via `src/lib/paths.ts`, never from user/backup strings — receipt paths are checked three times: Zod `isSafeReceiptPath`, the integrity check `relative_path === receipts/<id>.jpg`, and `toAbsolute` / `resolveUri` at use
- [x] Backup import enforces limits and allowlist before writing anything (Phase 6 fixtures, AC-18)
- [x] Error messages and diagnostics contain no personal data (AC-37 seeded-data test)
- [x] No network calls anywhere — no `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, or `sendBeacon` in `src/`; the only URL is the user-tapped `wa.me` link. Also no `console.*`, `eval`, or `new Function`
- [x] Release manifest permissions reviewed (merged manifest of a release-type build, Phase 10): exported components are only `MainActivity`, the Firebase receiver (guarded by `c2dm.permission.SEND`) and ProfileInstaller (guarded by `DUMP`); launcher-badge and install-referrer permissions remain (P7-1, Phase 11)
- [x] `allowBackup=false` confirmed in merged manifest
- [x] Keystore not in repo; `.gitignore` covers `*.jks`, `*.keystore`, `credentials.json` (plus `*.apk`, `*.hisaab`); `git ls-files` shows none
- [x] `npm audit --omit=dev` (2026-10-29): 16 advisories (4 high), all in build/CLI tooling — `@expo/cli` (node-forge, its own zod 3.25.76) and `@expo/config` / `jest-config` (deepmerge). None is in the app bundle; the app’s zod is 4.6.7 (already fixed). `npm audit fix --force` would downgrade Expo to 51 and must not be used. Re-check after the Expo patch update in Phase 11
- [x] Debug-only tools: `/dev-tools` renders nothing in release; the restore crash-test pause is `__DEV__` only. Deep links (`hisaab://`) only open screens; saving needs a tap and deleting needs a confirmation
