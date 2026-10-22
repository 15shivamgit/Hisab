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
| Error log (codes, versions, counts — no personal data) | App-private `diagnostics/errors.json` | Only when the user taps "Copy diagnostic info" and sends it |

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
| CAMERA | First time the user taps "Take photo" | Explain, offer gallery, "Open settings" |
| POST_NOTIFICATIONS (Android 13+) | First time a return-by date is set with reminders on | Date still saved; reminders shown in-app only |
| Biometric / device credential | When enabling app lock | Lock not enabled |
| Storage / media | **Not requested** (photo picker and document picker don't need it) | — |
| Contacts, SMS, location | **Never** | — |
| INTERNET | Dev builds only; blocked in release (verified in the Phase 2 release APK) | — |
| VIBRATE | Install time, no prompt (Expo template) | — |
| `<applicationId>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | Added by AndroidX; app-private signature permission, no prompt | — |
| Added by `expo-notifications` (e.g. RECEIVE_BOOT_COMPLETED, VIBRATE) | Install time, no prompt | — . Keeps scheduled reminders after reboot. `Verify:` exact list in Phase 11 |
| SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM | **Not used** — reminders use inexact date triggers; a few minutes' delay is acceptable | — |

`Verify:` in Phase 11, list the final merged manifest permissions and confirm no unexpected ones (some libraries add permissions automatically; remove with `blockedPermissions` if unneeded).

## Secure coding checklist (used in Phase 10 review)

- [ ] All SQL parameterised; dynamic `ORDER BY` from allowlist only
- [ ] Every file path built from IDs via `src/lib/paths.ts`, never from user/backup strings
- [ ] Backup import enforces limits and allowlist before writing anything
- [ ] Error messages and diagnostics contain no personal data
- [ ] No network calls anywhere (`grep` for `fetch`, `XMLHttpRequest`, `WebSocket`)
- [ ] Release manifest permissions reviewed
- [ ] `allowBackup=false` confirmed in merged manifest
- [ ] Keystore not in repo; `.gitignore` covers `*.jks`, `*.keystore`, `credentials.json`
