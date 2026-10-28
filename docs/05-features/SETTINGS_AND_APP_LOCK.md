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

## Phase 9 implementation

- **Settings in one place:** `SettingsProvider` (`src/hooks/SettingsContext.tsx`) reads all settings with one `useDbQuery` on `app_settings` and pushes `theme` into `ThemeProvider` (`useSetThemePreference`). Writes go through `settingsService` (`src/services/settingsService.ts`): theme, week start, and reminders are portable (they call `markDataChanged`); app lock, lock timeout, and onboarding are device-only. Reminder on/off/time and app lock re-plan reminders.
- **More tab:** Manage · Data · Preferences (theme System/Light/Dark, week start Monday/Sunday, udhaar reminders switch + time picker; turning reminders on asks for notification permission and shows "Open settings" if it is denied) · Security (app lock switch, Lock after Immediately / 30 s / 1 min / 5 min, screenshot note) · About → `/about` · Danger zone.
- **Root order:** `StartupGate` → `SettingsProvider` → `LockGate` → `OnboardingGate` → `Stack`. Lock and onboarding are gates around the navigator, not routes, so nothing behind them can be reached with Back.
- **Lock gate** (`src/features/lock/LockGate.tsx`):
  - Cold start with lock on: screens below the gate are not mounted (no data query) until unlock.
  - Later locks cover the app with a full-screen `Modal`: screens stay mounted underneath, so unsaved form input survives, and the Modal also covers an open sheet.
  - With "Immediately", the cover goes up as the app goes to the background.
  - Back on the lock screen exits the app.
  - The prompt opens by itself when the lock screen appears with the app in front; "Unlock" asks again after a cancel.
  - If the phone's screen lock is gone when unlocking, app lock is turned off (setting + secure flag) with the toast "App lock was turned off because this phone no longer has a screen lock."
- **Rules** (`src/lib/appLock.ts`, tested): lock when time away ≥ timeout; a trip to a system screen Hisaab opened never locks within 5 minutes. A trip counts as a system screen if one is still open **or** one was opened up to 10 s before the app went to the background — WhatsApp/SMS links and Android's text share resolve before the app leaves the screen.
- **System screens wrapped in `runWithoutLock`** (`src/platform/lockSession.ts`): camera + camera permission, photo picker, document picker, file share sheet, text share, WhatsApp/SMS links, Android app settings, the notification permission dialog, and the unlock prompt itself (its PIN screen pauses the app).
- **Enable:** `getEnrolledLevelAsync() ≥ SECRET`, otherwise "Set a screen lock on your phone first."; then one confirmation prompt. Turning it off asks nothing (the app is already unlocked).
- **Prompt:** `authenticateAsync({ promptMessage, disableDeviceFallback: false })` — biometrics or the device PIN/pattern/password.
- **Secure flag:** `preventScreenCaptureAsync('app-lock')` while lock is on, `allowScreenCaptureAsync` when off.
- **Onboarding** (`src/features/onboarding/`): 3 steps with Next/Back, step 3 has the optional lock switch (same checks as Settings), "Get started" saves the lock choice and `onboarding_completed`. Existing installs see it once after updating.
- **About** (`/about`): version (`versionName (versionCode)`), privacy promise, "Each phone has its own separate data…", Open-source licences (`/licenses`, generated by `npm run licenses` from the direct dependencies; a test fails when it is out of date), and **Share diagnostic info**.
- **Owner decision 2026-10-28:** diagnostic info is shared through the share sheet (which has its own Copy button) instead of copying with a clipboard library. Button text "Share diagnostic info"; no "Copied" toast. The report now includes the schema version and row counts.

## Verify results (Phase 9, vivo V2205, Android 14, dev build, 2026-10-29)

- **expo-local-authentication 58.0.2:** the phone (fingerprint + pattern) reports a level ≥ SECRET. The prompt shows "Unlock Hisaab", "Touch the fingerprint sensor", and a **"Use pattern"** fallback (device credential works with `disableDeviceFallback: false`). Back on the prompt cancels it and the lock screen stays.
- **expo-screen-capture 58.0.6:** with lock on, the window has FLAG_SECURE: `adb shell screencap` returns a 0-byte file and the recents card is a plain grey box. With lock off, screenshots work again (180 KB).
- **Found on the phone:** on Android 14+ the module registers a screenshot callback when it loads and needs `DETECT_SCREEN_CAPTURE`; with that permission blocked the app crashed at start. The permission is now kept (normal permission, no prompt); `READ_EXTERNAL_STORAGE` and `READ_MEDIA_IMAGES` stay blocked.
- Not checked on a device: an Android 13-or-older phone (no second device), removing the phone's screen lock while app lock is on (covered by a component test).

## Acceptance

- App lock on → force-stop → reopen asks for authentication before showing any amount.
- Timeout respected (manual test).
- Delete all data leaves default categories, keeps theme/device settings, removes all receipt files and the pre-restore safety backup.
- With lock timeout "Immediately": take a receipt photo → return to the form → no lock prompt, form input intact.
- With app lock on, a screenshot attempt is blocked and the recents preview is blank; with lock off, screenshots work.
- Diagnostic report contains no amounts, names, phone numbers, or notes (automated test with seeded data).
