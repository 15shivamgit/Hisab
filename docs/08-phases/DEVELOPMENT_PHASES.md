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
- [ ] Dev build runs on a real phone; tabs navigate; light/dark follows system. — **blocked: Android Studio not installed**
- [ ] Release-variant APK builds once (unsigned/debug-signed is fine here) to prove the pipeline. — **blocked: Android Studio not installed** (JS bundle export and prebuild manifest already verified)

Report: [reports/PHASE_02.md](reports/PHASE_02.md)

## Phase 3 — Database foundation

**Scope:** `DbClient` + both adapters, migration runner, migration 0001, all repositories for migration 1 tables, default category seed, `src/lib` money/dates/ids/paths/errors, `useDbQuery` + `notifyChanged`, `markDataChanged`, diagnostics error log (`diagnosticsService.record`).
**Acceptance:**
- [ ] Repository tests run against real SQLite (better-sqlite3) in Jest.
- [ ] Money/date unit tests cover FIN-M* and FIN-D* cases ([../10-testing/FINANCIAL_TEST_CASES.md](../10-testing/FINANCIAL_TEST_CASES.md)).
- [ ] Migrations idempotent; newer-DB-than-app check works.
- [ ] Category type trigger and FK RESTRICT proven by tests.
- [ ] Seed runs once.

## Phase 4 — Transactions, categories, basic dashboard

**Scope:** Transaction form/list/detail/edit/delete, search/filter/sort, categories screen, dashboard "This month" card, recent transactions, category spend list (chart may be a simple list until Phase 8).
**Acceptance:**
- [ ] TXN-01…10, CAT-01…05, DASH-01, DASH-02, DASH-07 (income/expense buttons), DASH-09.
- [ ] Data persists after force-stop and restart (manual on phone).
- [ ] Future-dated rule (FIN-T* cases).
- [ ] Owner can use the app daily (dev build).

## Phase 5 — Receipts

**Scope:** Picker (camera/gallery), compression pipeline, persistence, thumbnails, viewer with zoom, replace/delete, missing-file handling, orphan sweep.
**Acceptance:**
- [ ] RCP-01…07 and RECEIPTS.md acceptance list.
- [ ] Permission-denied paths tested manually.
- [ ] No orphan files after add/replace/delete/transaction delete (test + manual file listing).

## Phase 6 — Backup, restore, CSV export, delete all data

**Scope:** BACKUP_AND_RESTORE.md fully, CSV export for transactions, backup nudge, delete-all-data.
**Acceptance:**
- [ ] BAK-01…07, RPT-04, DASH-08, SET-06.
- [ ] Fixture tests for invalid/tampered/zip-slip/newer-version backups → no data change.
- [ ] Crash-recovery manual test passes.
- [ ] Performance spike (300 receipts) recorded and passing.
- [ ] Round trip: backup on phone A → restore on emulator → identical counts and receipts open.
- [ ] **Milestone: first signed release APK for the owner** (see BUILD_AND_RELEASE.md). Keystore created and backed up twice.

## Phase 7 — Udhaar

**Scope:** Migration 0002 (`people`, `udhaar_entries`), backup `schemaVersion` 2 + upgrade path from v1 backups, people list, person form, ledger, entry form with flip warning, return-by date, local notifications, reminder share (WhatsApp/SMS/share/copy), udhaar dashboard card, udhaar CSV.
**Acceptance:**
- [ ] UDH-01…12, DASH-05, DASH-06, DASH-07 (udhaar buttons), RPT-05.
- [ ] FIN-U* cases pass, including "udhaar never affects income/expense".
- [ ] v1 backup restores into v2 app.
- [ ] Notification fires on device (manual); permission denial handled.

## Phase 8 — Budgets and reports

**Scope:** Budgets screen and dashboard card, Reports tab (week/month/custom, category breakdown, trend chart), dashboard donut chart.
**Acceptance:**
- [ ] BUD-01…04, RPT-01…03, DASH-03, DASH-04.
- [ ] FIN-B* and FIN-R* cases pass.
- [ ] Charts readable in both themes and with font scale 150%.

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
