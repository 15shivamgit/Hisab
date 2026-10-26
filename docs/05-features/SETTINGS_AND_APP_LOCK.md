# Feature: Settings, App Lock, Onboarding

Status: Approved · Phase: 9 · Requirements: SET-01…08 · Decision: ADR-011

## More tab

Sections:
1. **Manage** — Categories · Budgets
2. **Data** — Backup & restore · Export CSV
3. **Preferences** — Theme · Week starts on · Reminders (on/off, time)
4. **Security** — App lock (toggle) · Lock after (Immediately / 30 s / 1 min / 5 min)
5. **About** — Version (versionName + versionCode), privacy statement, open-source licences, "Each phone has its own separate data", **Copy diagnostic info** (SET-09)
6. **Danger zone** — Delete all data

Until the full settings screen (Phase 9), the More tab has **Manage** (Categories), **Data** (Backup & restore, Export CSV) and **Danger zone** (Delete all data) — Phase 6.

## App lock (SET-02)

- Enable: requires `LocalAuthentication.hasHardwareAsync()` or a device credential, and `getEnrolledLevelAsync()` ≥ secret (device has PIN/pattern/password). If not: "Set a screen lock on your phone first." Authenticate once to confirm before enabling.
- Prompt allows biometrics with device-credential fallback.
- Lock triggers: cold start; returning to foreground after `app_lock_timeout_seconds` in background (0 = immediately).
- **System screens (ADR-016):** when Hisaab itself opens the camera, gallery/photo picker, document picker, share sheet, or a WhatsApp/SMS link (`appLockService.runWithoutLock`), returning within 5 minutes does not lock, so form input is never lost. After 5 minutes the normal rule applies.
- While locked: the lock screen covers everything; no data is queried until unlocked. Android back on the lock screen exits the app, never reveals data.
- **Recents and screenshots (ADR-016):** when app lock is enabled, the app sets Android's secure flag (`expo-screen-capture`). This hides content in the recent-apps preview **and blocks screenshots and screen recording** of Hisaab. The App lock row shows: "While app lock is on, screenshots of Hisaab are blocked." Turning the lock off clears the flag. `Verify:` behaviour on the current Android versions in the device matrix.
- If authentication becomes impossible later (user removed phone lock): disable app lock automatically and show a one-time notice.
- Reminder notifications: when app lock is **off**, they show the person's name and amount; when app lock is **on**, they show generic text only ("You have an udhaar reminder") so amounts don't appear on the lock screen. Templates: [../07-content/MESSAGE_TEMPLATES.md](../07-content/MESSAGE_TEMPLATES.md).

## Delete all data (SET-06)

Dialog: "Delete all data? This permanently deletes all entries, receipts, people, and budgets on this phone. This can't be undone." → second step: type **DELETE** → `dataService.deleteAllData()`. Offer "Create backup first" button in the dialog.

What happens (SERVICES_AND_LIBS.md `dataService`):

| Item | After delete |
|---|---|
| Transactions, receipts, categories, budgets, people, udhaar entries | Deleted; default categories re-created |
| Portable settings (theme, week start, reminders) | Kept |
| Device settings (app lock, onboarding done, `last_backup_at`) | Kept |
| `data_changed_since_backup`, `backup_nudge_dismissed_until` | `false` / `null` |
| Pre-restore safety backup (`backups/`), staging and export cache | Deleted ("Undo last restore" disappears) |
| Scheduled reminders | Cancelled |

## Diagnostics (SET-09)

About → **Copy diagnostic info** copies the report from `diagnosticsService.buildReport()` (versions, Android version, device model, schema version, row counts, last 50 error codes — no amounts, names, phones, or notes) and shows the toast "Copied". Friends paste it into WhatsApp for the owner. The same report is offered on the startup error screen.

## Updates for friends

There is no in-app update check (offline). The owner announces new versions on WhatsApp with the APK; About shows `versionName (versionCode)` so the owner can ask which build a friend has.

## Onboarding (SET-08)

Shown once (`onboarding_completed`):
1. "Your money diary, only on your phone" — no account, no internet.
2. "Back up regularly" — explains uninstall = data loss; backup file can be saved to Drive.
3. Optional: "Lock with fingerprint" toggle → [Get started].

## Acceptance

- App lock on → force-stop → reopen asks for authentication before showing any amount.
- Timeout respected (manual test).
- Delete all data leaves default categories, keeps theme/device settings, removes all receipt files and the pre-restore safety backup.
- With lock timeout "Immediately": take a receipt photo → return to the form → no lock prompt, form input intact.
- With app lock on, a screenshot attempt is blocked and the recents preview is blank; with lock off, screenshots work.
- Diagnostic report contains no amounts, names, phone numbers, or notes (automated test with seeded data).
