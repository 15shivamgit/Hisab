# Architecture

Status: Approved · Last updated: 2026-10-21

## Layers

```
┌──────────────────────────────────────────────────────────┐
│ app/  (Expo Router routes — thin screens)                │
│   uses feature components + hooks                        │
├──────────────────────────────────────────────────────────┤
│ src/features/*  (components, hooks, form schemas)        │
│   hooks call services (writes) and repositories (reads)  │
├──────────────────────────────────────────────────────────┤
│ src/services/*  (use cases: DB + files + notifications)  │
├───────────────────────────┬──────────────────────────────┤
│ src/db/repositories/*     │ src/lib/*  (pure functions:  │
│   (all SQL lives here)    │  money, dates, balance,      │
│ src/db/client.ts          │  budget, csv, validation)    │
│ src/db/migrations/*       │                              │
├───────────────────────────┴──────────────────────────────┤
│ expo-sqlite · expo-file-system · expo-notifications …    │
└──────────────────────────────────────────────────────────┘
```

### Rules

| Rule | Why |
|---|---|
| Screens in `app/` contain layout and navigation only. | Keeps routes readable |
| Components never import from `src/db`. | No SQL in UI |
| Repositories only do SQL and row ↔ model mapping. No file system, no notifications. | Easy to test against real SQLite in Node |
| Services orchestrate repositories, files, notifications, and enforce business rules that span more than one table or touch files. | One place for use cases |
| `src/lib` is pure (no I/O, no React). | Fast unit tests for all money/date logic |
| Expo modules are wrapped in small adapters (`src/platform/*`) so services can be tested with fakes. | Testability |

## Data access

### `DbClient` interface

```ts
interface DbClient {
  run(sql: string, params?: SqlParam[]): Promise<{ changes: number }>;
  get<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>; // several statements, no params — schema and PRAGMAs only
}
```

Two drivers, both wrapped by `createDbClient` in `src/db/client.ts` (ADR-017):
- `src/db/adapters/expoSqlite.ts` — app runtime, one connection to `hisaab.db`.
- `src/db/adapters/betterSqlite.ts` — tests only (Node). Excluded from the app bundle.

`createDbClient` runs every operation through one promise queue. `transaction` takes the queue, runs `BEGIN IMMEDIATE` … `COMMIT` (or `ROLLBACK` on any error) on the same connection, and passes a `tx` client that bypasses the queue. Nested `tx.transaction` calls join the outer transaction. Inside a transaction, code must use only `tx` — the outer client would wait forever.

Repositories check for a missing or wrong-type category themselves before writing, because SQLite runs the type triggers before the foreign-key check (a missing category would otherwise be reported as a type mismatch). The triggers stay as the safety net.

### Startup sequence

1. Open database `hisaab.db`.
2. `PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;`
3. Run pending migrations ([../03-database/MIGRATIONS.md](../03-database/MIGRATIONS.md)).
4. Seed default categories if none exist.
5. Run restore-journal recovery if a restore was interrupted ([../05-features/BACKUP_AND_RESTORE.md](../05-features/BACKUP_AND_RESTORE.md#crash-recovery)).
6. Schedule background housekeeping (after first render): receipt orphan sweep (at most once per 7 days), reminder reconcile.
7. If app lock is enabled → show lock screen before any data screen.

Any failure in steps 1–5 shows a full-screen error with "Try again" and "Share diagnostic info" (`diagnosticsService`, React Native's built-in `Share`; no data deleted automatically). A `DB_NEWER` error shows "Please update Hisaab" and no retry. Implemented in Phase 3: `src/services/startupService.ts` (steps 1–4) and `src/features/startup/StartupGate.tsx`, which wraps the root `Stack`; data screens get the client from `useDb()`. Step 5 (`backup.recoverIfInterrupted`) since Phase 6; step 6 (orphan sweep) since Phase 5.

## Reading and refreshing data (no global store)

- `useDbQuery(queryFn, deps, { tables: ['transactions', 'categories'] })` runs a repository read and re-runs it when any listed table changes.
- Services call `notifyChanged(['transactions'])` after a successful commit.
- A tiny in-memory event emitter connects the two. No caching layer beyond component state.
- UI-only state (filters, form state) stays in components. Theme and lock state use React context.

## Tracking changes since the last backup

Every service write that changes user data (transactions, attachments, categories, budgets, people, udhaar entries, portable settings) calls `markDataChanged(tx)` inside the same DB transaction. It sets `data_changed_since_backup = true`. Device-only settings do not call it. This flag drives the backup nudge (DASH-08), so no write path may skip it — a service test checks each write use case.

## Diagnostics

`diagnosticsService.record(error)` appends to a local error log (`<documentDirectory>/diagnostics/errors.json`, last 50 entries): timestamp, `AppError` code, where it happened (service/screen name), app version. **Never** amounts, names, phone numbers, notes, or file contents. `buildReport()` adds app version + versionCode (from the embedded app config), Android version and device model (`Platform`), DB schema version, and row counts. Used by the startup error screen and About → "Copy diagnostic info" (SET-09), so a friend can paste it into WhatsApp for the owner. No new dependency.

## Error model

`AppError` with a `code`:

| Code | Example | UI |
|---|---|---|
| `VALIDATION` | Amount is zero | Inline field message |
| `NOT_FOUND` | Transaction deleted elsewhere | Toast + navigate back |
| `CONSTRAINT` | Duplicate category name | Inline message |
| `IN_USE` | Delete category that has transactions | Dialog offering Archive |
| `FILE_MISSING` | Receipt file not found | Placeholder tile "Image missing" |
| `STORAGE_FULL` | Not enough free space | Dialog with required space |
| `PERMISSION_DENIED` | Camera denied | Explanation + "Open settings" |
| `UNSUPPORTED_FILE` | Picked a non-image | Toast |
| `BACKUP_INVALID` | Bad/corrupt backup file | Validation report, nothing changed |
| `DB_NEWER` | Database created by a newer app version (older APK installed over newer) | "Please update Hisaab"; data untouched |
| `UNKNOWN` | Anything else | Generic message; details copyable |

Errors are never swallowed silently. No error text includes amounts or notes when copied for diagnostics. `AppError` (`src/lib/errors.ts`) also carries a stable `detail` string (e.g. `CATEGORY_TYPE_MISMATCH`, `SYSTEM_CATEGORY`, `AMOUNT_RANGE`); the diagnostics log stores `code` + `detail` only, never `message`.

## Files on disk (app-private)

```
<documentDirectory>/
  hisaab.db                 (managed by expo-sqlite; actual location per SDK)
  receipts/<attachmentId>.jpg
  backups/pre-restore-<timestamp>.hisaab   (only the latest one kept)
  receipts-incoming/, receipts-old/, restore-journal.json   (only during a restore; see BACKUP_AND_RESTORE.md)
<cacheDirectory>/
  staging/                  (picker copies, backup build, restore staging)
  exports/                  (CSV and backup files before sharing)
```

Details: [../05-features/RECEIPTS.md](../05-features/RECEIPTS.md), [../05-features/BACKUP_AND_RESTORE.md](../05-features/BACKUP_AND_RESTORE.md).

## Notifications

`reminderService.reconcile()` is idempotent: cancel all app-scheduled reminders, then schedule one for every person with `return_by_date ≥ today`, balance ≠ 0, and reminders enabled. Called on app start, after udhaar/person changes, after settings changes, and after restore. No notification IDs are stored in the DB.
