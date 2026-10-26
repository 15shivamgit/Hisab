# Architecture Decision Records

Status: Approved · Last updated: 2026-10-21

Format: Context → Decision → Consequences. New decisions get the next number. Superseded decisions are marked, not deleted.

---

## ADR-001 — Expo with a development build

**Context.** Need React Native with minimal native setup on Windows. Some features (ZIP, notifications behaviour, release-like testing) are unreliable or unavailable in Expo Go.
**Decision.** Expo (latest stable SDK), TypeScript strict, Expo Router, and `expo-dev-client`. Expo Go is not used.
**Consequences.** One dev build must be installed on the phone/emulator (free, local or EAS Free). Any native dependency change requires a new dev build.

## ADR-002 — Raw SQL behind `DbClient`, no ORM

**Context.** Owner wants to understand the code; schema is small; repositories must be testable in Node.
**Decision.** Hand-written SQL in repositories, executed through a `DbClient` interface with an expo-sqlite adapter (app) and a better-sqlite3 adapter (tests).
**Consequences.** Full control and fewer dependencies. Row mapping is written by hand; keep it in one place per repository.

## ADR-003 — Integer paise, string dates

**Decision.** Money as integer paise. Business dates as local `YYYY-MM-DD`; audit timestamps as UTC ISO strings.
**Consequences.** No float errors; no timezone shifts moving an entry into another month. Requires `src/lib/money.ts` and `src/lib/dates.ts` to be the only conversion points.

## ADR-004 — Udhaar as a per-person ledger

**Context.** Original idea was full loan management (loans, statuses, interest, settlement). Owner clarified: just track money given to / taken from friends and its history.
**Decision.** Tables `people` and `udhaar_entries` (`gave`/`got`). Balance per person is derived. No `loans`/`loan_payments` tables, no interest, no statuses.
**Consequences.** Handles lending, borrowing, partial returns, and top-ups with one concept. Same friend can go in both directions over time. Edits/deletes are safe because nothing is stored derived. If interest or formal loans are ever needed, a new ADR is required.

## ADR-005 — Return-by date, local reminders, share message

**Decision.** Optional `return_by_date` on the person (applies to the current balance). Local notification via `expo-notifications` on that date at the reminder time. "Send reminder" builds a text and opens the share sheet / WhatsApp / SMS.
**Consequences.** Needs POST_NOTIFICATIONS runtime permission on Android 13+ (asked only when the user first sets a date). No SMS permission (the SMS app sends it).

## ADR-006 — No accounts, no transfers

**Decision.** v1 has no account/wallet model. Dashboard shows "Recorded cash flow (income − expense)".
**Consequences.** Simpler UX. Cannot show real balances. `accounts` table is reserved for a future version.

## ADR-007 — Future-dated transactions excluded from totals

**Decision.** Allowed and listed with an "Upcoming" badge; counted only when `txn_date ≤ today`.
**Consequences.** Totals change automatically when the date arrives; screens compute `today` on focus.

## ADR-008 — Receipt storage

**Decision.** Images only. Resize so the longest edge ≤ 1600 px, JPEG quality 0.7. Store at `receipts/<attachmentId>.jpg`; DB stores the relative path. Max 5 per transaction; max input 25 MB.
**Consequences.** Readable receipts at ~150–400 KB. Backups stay manageable.

## ADR-009 — Backup format and replace-only restore

**Context.** Merge restore creates hard conflict cases. Partial restores can corrupt data.
**Decision.** A single `.hisaab` file = ZIP containing `manifest.json`, `data.json`, `receipts/*.jpg`, built and read with `fflate` (pure JS). Restore is replace-only: validate fully → safety backup → DB swap in one transaction → receipt folder swap with a journal for crash recovery.
**Consequences.** Simple mental model ("restore = go back to that backup"). Phase 6 must include a memory spike with ~300 receipts on a low-end device; if `fflate` is too heavy, a native ZIP module will be proposed as an ADR amendment.
**Amendment (2026-10-26, Phase 6).** The spike passed on a 2 GB emulator (backup +31 MB, restore +52 MB over baseline; BACKUP_AND_RESTORE.md § Spike result), so no native module is needed. Writing uses fflate's `Zip`; **reading uses our own central-directory reader** (`src/lib/zip/zipReader.ts`) with fflate only for inflating `data.json`/`manifest.json`, because fflate's streaming `Unzip` can cut a stored entry short when its bytes contain a ZIP signature. Files are read and written through `expo-file-system` file handles in pieces.

## ADR-010 — Android Auto Backup disabled

**Context.** Auto Backup to Google Drive has a size limit, can restore a DB without matching receipt files, and sends financial data to the cloud without the user consciously choosing it.
**Decision.** `allowBackup = false`. Manual backup files are the only supported path; the app nudges the user to back up.
**Consequences.** Users who never back up lose data on phone loss or uninstall. Mitigated by onboarding text, backup screen warnings, and the dashboard nudge.

## ADR-011 — App lock via device authentication

**Decision.** `expo-local-authentication` with device-credential fallback (fingerprint/face/PIN/pattern of the phone). No custom PIN. No SecureStore in v1. Lock can be enabled only if the device has a secure lock set.
**Consequences.** Nothing secret to store. If the user removes their phone lock, the app disables app lock and tells them.

## ADR-012 — Block INTERNET permission in release

**Decision.** Release builds remove `android.permission.INTERNET` via config (dev builds keep it for Metro). Verified in Phase 11 by inspecting the merged manifest and running the app.
**Consequences.** Provable "offline only" privacy claim. If any required library breaks without it, document the finding and decide with the owner.

## ADR-013 — No global state library

**Decision.** React context for theme/lock; `useDbQuery` + `notifyChanged` for data; local component state otherwise.
**Consequences.** Fewer concepts. Revisit only if cross-screen state becomes painful.

## ADR-014 — APK distribution with one protected keystore

**Decision.** Distribute a signed release APK directly. Create one release keystore, back it up in two separate places (e.g. pendrive + personal cloud drive), store passwords in a password manager, never commit it. `versionCode` increases with every build.
**Consequences.** Friends can update by installing the new APK over the old one and keep their data. **Losing the keystore means friends must uninstall (losing data unless they have a backup) to install a new build.**

## ADR-015 — Backup before udhaar in the plan

**Decision.** Phase order puts backup/restore (Phase 6) before udhaar (Phase 7). Friends receive builds only after backup/restore passes its acceptance criteria.
**Consequences.** Real data is protected early. Backup format must be versioned so udhaar tables added later are handled (`formatVersion`, `schemaVersion`).
**Amendment (2026-10-21).** Owner decided that friends receive a build only after Phase 11 (complete app with onboarding, app lock, and release checks). The owner uses a release APK from Phase 6.

## ADR-016 — App lock around system screens; screenshots blocked while locked

**Context.** With the lock timeout set to "Immediately", opening the camera for a receipt sends Hisaab to the background, so returning would lock the app and could lose form input. Hiding content in the recent-apps preview uses Android's secure flag, which also blocks screenshots and screen recording.
**Decision.** (1) While Hisaab itself opens a system screen (camera, gallery/photo picker, document picker, share sheet, WhatsApp/SMS link), the lock timer is suspended; returning within 5 minutes does not lock. Longer than that, the normal lock rule applies. (2) When app lock is on, the secure flag is set: content hidden in recents, screenshots and screen recording of Hisaab blocked. Owner accepted both on 2026-10-21.
**Consequences.** Receipt capture and sharing work smoothly with lock on. The user cannot screenshot Hisaab while app lock is on; the setting says so, and turning the lock off re-enables screenshots.

## ADR-017 — Serialized transactions on one connection

**Context.** ARCHITECTURE.md planned `withExclusiveTransactionAsync` for writes. Reading expo-sqlite 58's source (Phase 3) showed it opens a **new connection** for every transaction and runs `BEGIN` before our callback. `PRAGMA foreign_keys` is per connection and is a no-op inside a transaction, so FK rules (RESTRICT, CASCADE) would silently not apply inside transactions.
**Decision.** One connection for the app's lifetime. `createDbClient` (`src/db/client.ts`) serializes all operations through a promise queue; `transaction` runs `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK` on that connection with a `tx` client that bypasses the queue. The same code wraps better-sqlite3 in tests.
**Consequences.** Foreign keys are always on. No query can interleave with a transaction. Reads wait while a transaction runs (fine for a single-user app; transactions are short). Inside a transaction, code must use `tx`, never the outer client.
