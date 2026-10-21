# Project Context

Status: Approved · Last updated: 2026-10-21

## In one paragraph

**Hisaab** is a free, offline Android app for one person to record income and expenses (with receipt photos), set monthly budgets, see reports, and keep a simple history of money given to or taken from friends (**udhaar**). All data lives in a local SQLite database on the phone. There is no login, no server, no cloud, and no cost. The owner uses it first, then shares the APK with a few friends — each phone has its own separate data.

## Constraints

| Constraint | Meaning |
|---|---|
| Zero cost | ₹0 to build, run, and distribute. Play Store ($25 one-time) is deferred and optional. |
| Offline | Every feature works in airplane mode. Release build should not even request the INTERNET permission (goal, see ADR-012). |
| Single user per phone | No accounts, no sync, no sharing of data between phones. |
| Android first | iOS is not a target. |
| Solo developer | Keep the stack small and understandable. |

## Key decisions (summary)

Full reasoning in [02-architecture/DECISIONS.md](02-architecture/DECISIONS.md).

| # | Decision |
|---|---|
| ADR-001 | Expo + React Native + TypeScript strict + Expo Router. Development build (`expo-dev-client`), not Expo Go. |
| ADR-002 | Raw SQL via `expo-sqlite` behind a small `DbClient` interface; repositories in `src/db/repositories`. No ORM. |
| ADR-003 | Money = integer paise. Dates = local `YYYY-MM-DD` strings; timestamps = UTC ISO 8601. |
| ADR-004 | Udhaar = simple **per-person ledger** (`gave` / `got` entries). No loans table, no interest, no statuses. Balance is always derived. |
| ADR-005 | Optional "return by" date per person + local notification reminder + WhatsApp/SMS share message. |
| ADR-006 | No accounts and no transfers in v1. Dashboard shows "recorded cash flow", never "bank balance". |
| ADR-007 | Future-dated transactions are allowed but excluded from totals until their date arrives. |
| ADR-008 | Receipts: images only, compressed to JPEG, stored in app-private storage, relative path in DB, max 5 per transaction. |
| ADR-009 | Backup = single `.hisaab` file (ZIP: manifest + JSON data + receipts). Restore = **replace only**, with automatic safety backup first and staged, validated, journaled apply. |
| ADR-010 | Android Auto Backup disabled. Manual backup is the only supported backup path; app reminds the user. |
| ADR-011 | App lock via device biometrics / device PIN (`expo-local-authentication`). No custom PIN, no SecureStore in v1. |
| ADR-012 | Release build blocks the INTERNET permission if no dependency needs it. |
| ADR-013 | No global state library. React context for theme/lock; small `useDbQuery` hook with table-based invalidation for data. |
| ADR-014 | Distribution: signed release APK shared directly. One release keystore, backed up in two places, never committed. |
| ADR-015 | Backup moved before udhaar in the phase plan. Owner gets a release APK at Phase 6; friends only after Phase 11 (amended 2026-10-21). |
| ADR-016 | App lock: no lock when returning from camera/gallery/share within 5 min; while lock is on, screenshots of the app are blocked (secure flag). |

## Phase status

| Phase | Name | Status |
|---|---|---|
| 1 | Specifications (this docs folder) | **Approved** (2026-10-21) |
| 2 | Project setup | **In progress** — code done; device build waits for Android Studio |
| 3 | Database foundation | Not started |
| 4 | Transactions, categories, basic dashboard | Not started |
| 5 | Receipts | Not started |
| 6 | Backup, restore, CSV export | Not started |
| 7 | Udhaar | Not started |
| 8 | Budgets and reports | Not started |
| 9 | Settings, app lock, onboarding, polish | Not started |
| 10 | QA and hardening | Not started |
| 11 | Release APK and friend distribution | Not started |

Details: [08-phases/DEVELOPMENT_PHASES.md](08-phases/DEVELOPMENT_PHASES.md)

## Owner decisions (Phase 1 questions)

| # | Question | Decision (2026-10-21) |
|---|---|---|
| Q1 | Android application ID (cannot change after friends install) | **`com.shivambgs15.hisaab`** (dev build: `com.shivambgs15.hisaab.dev`) |
| Q2 | UI language: English, Hinglish, or Hindi? | **English.** All strings centralised in `src/content/` so a translation can be added later |
| Q3 | Week starts on Monday or Sunday? | **Monday** (setting available) |
| Q4 | App icon and primary brand colour | **Sky blue** primary. Icon: white ledger book with ₹ on a sky-blue background (concept: [06-design/app-icon-concept.svg](06-design/app-icon-concept.svg)). See DESIGN_TOKENS.md |
| Q5 | Default reminder time for udhaar notifications | **09:00** local time |
