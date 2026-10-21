# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). Versions follow `versionName` in the app; `versionCode` noted for every build given to anyone.

## [Unreleased]

### Added
- 2026-10-21 — Phase 1 approved by the owner.
- 2026-10-21 — Phase 1: initial specification set in `docs/` (overview, requirements, financial rules, architecture, ADRs, schema, internal API, feature specs, design, content, phases, config, testing).

### Changed (from the original brief)
- Loan management replaced by a simple per-person **udhaar ledger** (gave/got) with no interest or statuses (ADR-004). Tables `loans`/`loan_payments` replaced by `people`/`udhaar_entries`.
- Backup/restore moved before udhaar in the phase plan (ADR-015).
- Zero-cost policy added; Play Store deferred (US$25 fee).
- 17 flat docs reorganised into the numbered folder structure.
- 2026-10-21 — Owner decisions: UI language English (Q2), week starts Monday (Q3), sky-blue brand colour + ledger-book ₹ icon concept (Q4), reminder time 09:00 (Q5), application ID `com.shivambgs15.hisaab` (Q1).
- 2026-10-21 — Spec review fixes:
  - Category delete: only transactions block deletion; a budget is removed with the category. New trigger `trg_categories_type_locked`. "Other" cannot be renamed (CAT-05).
  - DASH-04 uses "highest percentage" budgets; DASH-08 backup nudge rule unified, new setting `backup_nudge_dismissed_until`.
  - Friends get a build only after Phase 11 (ADR-015 amendment).
  - ADR-016: no app lock when returning from camera/share within 5 min; screenshots blocked while app lock is on.
  - Backup: `manifest.missingFiles`; restore free-space check includes the safety backup; `data_changed_since_backup` after restore defined.
  - `markDataChanged` required on every user-data write; `deleteAllData` fully specified (also removes safety backup and caches).
  - Receipts: EXIF orientation applied before stripping; camera process-death recovery; edit-form receipt changes apply on save (`transactionService.update` with `receiptChanges`).
  - Udhaar reminders: notification channel, inexact triggers, reboot survival.
  - Diagnostics error log + "Copy diagnostic info" (SET-09); About shows versionCode.
- 2026-10-21 — Added from review suggestions: search by exact amount (TXN-05), Duplicate transaction (TXN-10), "+ Add person" in the dashboard person picker, ARM-only smaller APK build, FlatList (no FlashList), dark `border` token `#334155`, CSV import listed as out of scope.
