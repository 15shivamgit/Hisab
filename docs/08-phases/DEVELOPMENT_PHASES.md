# Development Phases

Status: Approved · Last updated: 2026-10-21

Rules:
- One phase at a time. The app stays runnable at the end of every phase.
- A phase is complete only when **all** its acceptance criteria are verified and the owner approves the phase report ([PHASE_REPORT_TEMPLATE.md](PHASE_REPORT_TEMPLATE.md)).
- Do not pull work forward from later phases without approval.
- Backup comes before udhaar (ADR-015). The owner gets a release APK at Phase 6; **friends get a build only after Phase 11** (ADR-015 amendment).

---

## Phase 1 — Specifications

**Goal:** Complete, consistent specs in `docs/`.
**Deliverables:** This folder.
**Acceptance:**
- [x] Owner has read PROJECT_CONTEXT.md and answered or accepted defaults for Q1–Q5. (2026-10-21)
- [x] No contradictions between FINANCIAL_RULES, DATABASE_SCHEMA, and feature docs. (review fixes 2026-10-21, see CHANGELOG)
- [x] Owner approves → statuses set to `Approved`. (2026-10-21)

## Phase 2 — Project setup

**Goal:** Empty but production-shaped app running on the owner's phone.
**Scope:**
- Verify latest stable Expo SDK; create app in `d:\Code\hisaab` with TypeScript + Expo Router (keep `docs/`).
- Git repo, root `.gitignore`, and root `CLAUDE.md` (`@docs/CLAUDE.md`) already exist from Phase 1 — merge the Expo template's `.gitignore` entries into ours, don't overwrite.
- TS strict, path alias, ESLint + Prettier, Jest (jest-expo) + RNTL, scripts: `typecheck`, `lint`, `format`, `test`.
- `app.config.ts` per [../09-config/APP_CONFIG.md](../09-config/APP_CONFIG.md) (app ID, `allowBackup=false`, dev/release variants).
- Theme tokens + ThemeProvider (light/dark/system), base components (`Screen`, `Button`, `Card`, `EmptyState`).
- Tab navigation with placeholder screens.
- `expo-dev-client` development build installed on the owner's phone and emulator.
- Record pinned versions in TECH_STACK.md.
**Acceptance:**
- [x] `npm run typecheck`, `lint`, `test` pass (one sample test). (2026-10-21: 3 suites, 40 tests)
- [x] Dev build runs on a real phone; tabs navigate; light/dark follows system. (2026-10-22, vivo V2205 / Android 14)
- [x] Release-variant APK builds once (unsigned/debug-signed is fine here) to prove the pipeline. (2026-10-22, 42.8 MB, no INTERNET permission)

Report: [reports/PHASE_02.md](reports/PHASE_02.md)

## Phase 3 — Database foundation

**Scope:** `DbClient` + both adapters, migration runner, migration 0001, all repositories for migration 1 tables, default category seed, `src/lib` money/dates/ids/paths/errors, `useDbQuery` + `notifyChanged`, `markDataChanged`, diagnostics error log (`diagnosticsService.record`).
**Acceptance:**
- [x] Repository tests run against real SQLite (better-sqlite3) in Jest.
- [x] Money/date unit tests cover FIN-M* and FIN-D* cases ([../10-testing/FINANCIAL_TEST_CASES.md](../10-testing/FINANCIAL_TEST_CASES.md)).
- [x] Migrations idempotent; newer-DB-than-app check works.
- [x] Category type trigger and FK RESTRICT proven by tests.
- [x] Seed runs once. (tests + phone restart, 2026-10-22)

Report: [reports/PHASE_03.md](reports/PHASE_03.md)

## Phase 4 — Transactions, categories, basic dashboard

**Scope:** Transaction form/list/detail/edit/delete, search/filter/sort, categories screen, dashboard "This month" card, recent transactions, category spend list (chart may be a simple list until Phase 8).
**Acceptance:**
- [x] TXN-01…10, CAT-01…05, DASH-01, DASH-02, DASH-07 (income/expense buttons), DASH-09.
- [x] Data persists after force-stop and restart (manual on phone).
- [x] Future-dated rule (FIN-T* cases).
- [x] Owner can use the app daily (dev build).

Report: [reports/PHASE_04.md](reports/PHASE_04.md)

## Phase 5 — Receipts

**Scope:** Picker (camera/gallery), compression pipeline, persistence, thumbnails, viewer with zoom, replace/delete, missing-file handling, orphan sweep.
**Acceptance:**
- [x] RCP-01…07 and RECEIPTS.md acceptance list (exceptions listed in the report: real camera photos, a second phone, HEIC, low-memory camera recovery on a device).
- [x] Permission-denied paths tested manually (camera "Don't allow" → dialog → gallery).
- [x] No orphan files after add/replace/delete/transaction delete (tests + `receipts/` and `cache/staging/` listed on the phone).

Report: [reports/PHASE_05.md](reports/PHASE_05.md)

## Phase 6 — Backup, restore, CSV export, delete all data

**Scope:** BACKUP_AND_RESTORE.md fully, CSV export for transactions, backup nudge, delete-all-data.
**Acceptance:**
- [x] BAK-01…07, RPT-04, DASH-08, SET-06.
- [x] Fixture tests for invalid/tampered/zip-slip/newer-version backups → no data change.
- [x] Crash-recovery manual test passes (emulator, both journal stages).
- [x] Performance spike (300 receipts) recorded and passing (BACKUP_AND_RESTORE.md § Spike result).
- [x] Round trip: backup in the owner's Hisaab Dev → restore into the freshly installed release Hisaab on the same phone (separate app, empty storage) → identical dashboard, counts, and receipts open. The emulator leg was skipped so the owner's photos weren't copied to another device (report P6-3).
- [x] **Milestone: first signed release APK for the owner** — `hisaab-1.0.0-vc1.apk` (versionCode 1), installed on the owner's phone. Keystore created; owner reported two backup copies.

Report: [reports/PHASE_06.md](reports/PHASE_06.md)

## Phase 7 — Udhaar

**Scope:** Migration 0002 (`people`, `udhaar_entries`), backup `schemaVersion` 2 + upgrade path from v1 backups, people list, person form, ledger, entry form with flip warning, return-by date, local notifications, reminder share (WhatsApp/SMS/share/copy), udhaar dashboard card, udhaar CSV.
**Acceptance:**
- [x] UDH-01…12, DASH-05, DASH-06, DASH-07 (udhaar buttons), RPT-05.
- [x] FIN-U* cases pass, including "udhaar never affects income/expense" (tests + on the phone).
- [x] v1 backup restores into v2 app (test with a schema-1 backup).
- [x] Notification fires on device (manual); permission denial handled; also after a phone reboot.

Report: [reports/PHASE_07.md](reports/PHASE_07.md)

## Phase 8 — Budgets and reports

**Scope:** Budgets screen and dashboard card, Reports tab (week/month/custom, category breakdown, trend chart), dashboard donut chart.
**Acceptance:**
- [x] BUD-01…04, RPT-01…03, DASH-03, DASH-04 (DASH-03 tap goes to filtered Transactions — see report).
- [x] FIN-B* and FIN-R* cases pass.
- [x] Charts readable in both themes and with font scale 150% (icon clipping P8-1 is a Phase 4 component issue).

Report: [reports/PHASE_08.md](reports/PHASE_08.md)

## Phase 9 — Settings, app lock, onboarding, polish

**Scope:** More tab, theme/week-start/reminder settings, app lock with timeout, recents hiding and system-screen suspension (ADR-016), onboarding, About + licences + "Copy diagnostic info", empty/loading/error state review on every screen.
**Acceptance:**
- [ ] SET-01…09.
- [ ] Every screen has loading/empty/error states (checklist in PR/phase report).

## Phase 10 — QA and hardening

**Scope:** Full test run, Maestro E2E flows, offline (airplane mode) pass, real-device matrix, accessibility review, security review checklist, performance with 5,000 transactions, bug fixing.
**Acceptance:**
- [ ] All items in [../10-testing/ACCEPTANCE_CRITERIA.md](../10-testing/ACCEPTANCE_CRITERIA.md).
- [ ] No open P1/P2 defects; known P3 listed.

## Phase 11 — Release APK and friend distribution

**Scope:** Signed release APK, INTERNET permission removed (ADR-012), manifest review, install on owner's and friends' phones, friend install guide, update-over-install test.
**Acceptance:**
- [ ] [../10-testing/RELEASE_CHECKLIST.md](../10-testing/RELEASE_CHECKLIST.md) fully checked.
- [ ] Update from previous APK keeps data (tested).
- [ ] Optional: Play Store preparation notes reviewed (no fee paid unless owner decides).
