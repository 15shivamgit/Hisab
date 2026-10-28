# Phase Report — Phase 7: Udhaar

Date: 2026-10-28 · Branch: `main`

**Status: acceptance criteria verified on the owner's phone (exceptions in § 5) — awaiting owner approval.**

## 1. What was implemented

- **Data (UDH-01…05, ADR-004):**
  - Migration 2 creates `people` and `udhaar_entries`.
  - Balances are always derived: Σ gave − Σ got (`src/lib/balance.ts`).
  - Running balance per entry; flip check (FR-4.6); overdue and due-soon (FR-4.10); totals that are never netted (FR-4.9).
- **Backups:** format schema 2 adds `people` and `udhaarEntries`. A schema-1 backup is upgraded in memory (empty udhaar). Integrity checks now include "entry's person exists".
- **Udhaar tab (UDH-10):**
  - "You will get / You owe" summary, search, filters (All / You will get / You owe / Settled / Overdue), and sort (Amount / Name / Recent).
  - Rows with initials, last entry, balance in words + icon + colour, and Overdue / Due badges.
  - Show archived, "+ Add person" button, empty state.
- **Person form (UDH-01):**
  - Name; phone (normalised; used for WhatsApp/SMS); notes.
  - Duplicate name gives a warning, not an error.
  - From "I gave / I got" it continues straight to the entry form.
- **Ledger (UDH-03, UDH-04, UDH-07, UDH-11):**
  - Balance, return-by chip (picker from today), I gave / I got, Remind (when not settled), and entries newest first with the balance after each.
  - Menu: Edit, Clear return date, Archive (settled only), Delete (no entries only).
- **Entry form (UDH-02, UDH-05, UDH-06):**
  - Direction, amount, live "After this: …" preview, date (no future, FR-4.12), payment method (default Cash), note.
  - Flip warning; delete with the new balance shown; "settled — remove the return date?" (FR-4.11).
  - "Udhaar is not income or expense" note.
- **Reminders (UDH-08):**
  - Local notification at `reminder_time` on the return-by date, on channel `udhaar-reminders`, with a white ₹ icon in the brand colour.
  - Permission is asked when a date is set; if denied, the date is kept and Settings is offered.
  - Reconciled at startup and after every change, restore, and delete-all. Tapping a reminder opens the ledger.
- **Remind (UDH-09):** editable message from `MESSAGE_TEMPLATES.md`, sent through WhatsApp (`wa.me`, Indian numbers get 91), SMS (`sms:`), or Share (whose sheet has Android's Copy).
- **Dashboard (DASH-05/06/07):** I gave / I got quick actions (person picker, or Add person when nobody exists yet), and an udhaar card with totals and up to 3 overdue / due-soon people.
- **Udhaar CSV (RPT-05):** More → Export CSV, with the signed balance after each entry written as a number.
- **Package (approved 2026-10-28):** expo-notifications 58.1.6.

## 2. Files created or changed

| Area | Files |
|---|---|
| Data | `src/db/migrations/0002_udhaar.ts`, `migrations/index.ts`, `repositories/{personRepository,udhaarRepository}.ts`, `backupRepository.ts` (2 tables), `src/db/types.ts` |
| Libraries | `src/lib/{balance,phone}.ts`, `src/lib/csv.ts` (`csvNumber`) |
| Services | `src/services/{udhaarService,reminderService}.ts`, `appServices.ts` (`udhaar`, `reminders`, `replanReminders`), `dashboardService.ts`, `exportService.ts` (`udhaarCsv`), `dataService.ts` / `backup/*` (re-plan reminders, schema 2, upgrade step) |
| Platform | `src/platform/notifications.ts` |
| Content | `src/content/{templates,strings}.ts` |
| Screens | `src/features/udhaar/{UdhaarScreen,PersonFormScreen,PersonLedgerScreen,PersonPickerScreen,UdhaarEntryScreen}.tsx`, `components/{BalanceText,PersonRow,RemindSheet}.tsx`, `{dueText,schema}.ts`; `src/features/dashboard/components/UdhaarCard.tsx`, `DashboardScreen.tsx`; `ExportScreen.tsx`; `src/hooks/useDebounced.ts` |
| Routes | `src/app/(tabs)/udhaar.tsx`, `src/app/person/{new,pick,[id]}.tsx`, `src/app/person/[id]/edit.tsx`, `src/app/udhaar-entry/new.tsx`, `src/app/udhaar-entry/[id]/edit.tsx`; `src/app/(tabs)/_layout.tsx` (reminder tap), `StartupGate.tsx` (channel + reconcile) |
| Config | `app.config.ts` (POST_NOTIFICATIONS, plugin, c2dm blocked), `assets/images/notification-icon.png`, `package.json` (`expo-notifications`, Jest `testTimeout` 20 s) |
| Tests | `src/lib/{balance,phone}.test.ts`, `src/services/udhaar.repo.test.ts`, `src/features/udhaar/dueText.test.ts`, additions in `migrations.repo.test.ts`, `backup.repo.test.ts`, `phase6Services.repo.test.ts`, `csv.test.ts` |

## 3. Commands and tests actually executed

```
npx expo install expo-notifications            → 58.1.6
npx tsc --noEmit                               → passed
npm run lint                                   → 1 error (import/namespace false positive on AndroidImportance) + 2 warnings → fixed → passed
npx jest                                       → 31 suites, 376 tests passed (twice in a row under load)
  first runs: 2 component tests failed under load — captured: "Exceeded timeout of 5000 ms" → Jest testTimeout 20 s
gradlew assembleDebug (arm64) → BUILD SUCCESSFUL in 19m 21s; adb install -r → Success (owner's data kept)
APP_VARIANT=release prebuild + gradlew :app:processReleaseMainManifest → merged release manifest inspected
adb reboot (owner agreed) → boot 110 s
```

## 4. Test results

Phone: vivo V2205, Android 14, dev build. Test person "Test Rahul" and "Test Reboot", removed afterwards; reminder time reset to 09:00.

| Check | Result | Evidence |
|---|---|---|
| Unit/repo tests | ✅ | FIN-U01…U16 (pure + repository), edit/delete recompute, ledger order, future date rejected (add + edit), flip preview while editing, writes mark data changed + re-plan, return-by rules, people filters/search/sort, totals, CSV source, reminder reconcile (eligible only, idempotent, off / no permission / time passed, app-lock text), templates, phone/WhatsApp/SMS formats, dashboard card, migration 1 → 2 with data, backup schema 2 round trip, **schema-1 backup restores**, entry with a missing person rejected |
| Migration 2 on the phone | ✅ | App started on the existing data; dashboard unchanged |
| "I gave" with nobody added → Add person → entry form | ✅ | Name + phone "98765 43210"; entry form opened with I gave |
| Live preview / flip warning | ✅ | "After this: You will get ₹10,000"; got ₹12,000 → "Check this amount … You owe ₹2,000" → Change amount → ₹3,000 |
| FIN-U01 on device, running balance | ✅ | 10,000 then 7,000; "You will get ₹7,000" |
| UDH-12 on device | ✅ | Income ₹50,000 / Expense ₹8,940 / Net ₹41,060 unchanged after udhaar entries |
| Dashboard udhaar card | ✅ | "You will get ₹10,000 ↓ from 1 person" |
| Return-by date: prompt, deny path | ✅ | Picker starts today; POST_NOTIFICATIONS prompt; Don't allow → date saved + "Notifications are off…" dialog |
| Reminder fires at the reminder time | ✅ | 17:11–17:12: "Udhaar reminder — Test Rahul was to return ₹7,000 today.", channel `udhaar-reminders`, colour #0284C7, inexact RTC alarm, no exact-alarm permission |
| Tap reminder → ledger (app running) | ✅ | Opened Test Rahul's ledger from Developer tools |
| **Reminder after a phone reboot** | ✅ | Scheduled 17:48 → `adb reboot` → boot 17:45:35 → alarm re-registered 17:47:51 after unlock → notification 17:48:01 without opening the app; tap (cold start) → ledger |
| Remind sheet / Share | ✅ | Message with return date; Share sheet shows the text and a Copy button |
| Settle → remove return date | ✅ | "Test Rahul is settled 🎉 Remove the return date?" → Remove; no pending alarm |
| Archive / delete rules | ✅ | Delete disabled with entries ("can only be archived"); Archive → hidden; Show archived → Unarchive; entry delete dialog shows the new balance; delete person when empty |
| Release manifest | ✅ | No INTERNET; `c2dm.permission.RECEIVE` removed; dangerous permissions only CAMERA + POST_NOTIFICATIONS |

## 5. Known issues and risks

| ID | Priority | Description | Plan |
|---|---|---|---|
| P7-1 | P2 | The release manifest also gets no-prompt permissions from expo-notifications' badge library (ShortcutBadger: ~20 launcher badge permissions, `READ_APP_BADGE`) and Firebase (`BIND_GET_INSTALL_REFERRER_SERVICE`, `WAKE_LOCK`, `ACCESS_NETWORK_STATE`). No network (no INTERNET), no prompts, but more than needed. | Phase 11 manifest review: block the badge/referrer ones and test the release APK |
| P7-2 | P3 | WhatsApp and SMS buttons were not opened on the phone (a dummy number could be a real person). URL formats are unit-tested; Share was tested. | Owner tries Remind with a friend's real number |
| P7-3 | P3 | No new release APK this phase, so the size effect of Firebase/ShortcutBadger is not measured, and the owner's release app has no udhaar yet. | Build 1.1.0 (versionCode 2) when the owner wants it |
| P7-4 | — | The two flaky component tests from Phase 6 (P6-5) were caught: Jest's 5 s per-test limit under load. | Fixed: `testTimeout` 20 s; 376/376 twice under load |
| P7-5 | P3 | "Copy text" (UDHAAR.md § Remind) is covered by Android's share sheet Copy button instead of a separate button, avoiding a clipboard dependency. | Owner to confirm; `expo-clipboard` would be needed for Phase 9 "Copy diagnostic info" anyway |
| P7-6 | P3 | Dev build only: the dev-client gear sits on the ledger's menu icon; turned off in the dev menu ("Tools button"). Metro hung twice (cache error, file watcher); restarted with `--clear`. | — |
| P7-7 | P3 | The entry form's Delete is a blue text button; it opens a confirmation, but a red style would signal danger better. | Small polish in Phase 9 |

## 6. Documentation updated

UDHAAR (Verify results, implementation), TECH_STACK (expo-notifications), APP_CONFIG, SECURITY_AND_PRIVACY, MIGRATIONS, REPOSITORIES, SERVICES_AND_LIBS, DASHBOARD, REPORTS_AND_EXPORT, UI_COPY, DEVELOPMENT_PHASES, PROJECT_CONTEXT, CHANGELOG.

## 7. Exact next steps

1. Owner approves Phase 7.
2. Optional: release APK 1.1.0 (versionCode 2) so the everyday Hisaab app gets udhaar (back up first; install over 1.0.0 keeps data).
3. Phase 8 — Budgets and reports: budget screen and dashboard card, Reports tab (week / month / custom, category donut, trend bars), Reports CSV. Needs `react-native-gifted-charts` + `react-native-svg` (listed in TECH_STACK; versions and peers to verify, approval to confirm).

## Owner approval

- [x] Approved to start Phase 8 — owner, 2026-10-28
