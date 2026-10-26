# Internal API — Services and Pure Libraries

Status: Approved · Last updated: 2026-10-21

## Services (`src/services`)

**Implemented signature style (Phase 4):** service functions take `(db, clock, …)` — e.g. `transactionService.create(db, clock, input)` — so tests pass a test DB and a fixed clock; screens pass `useDb()` and `systemClock`. Implemented so far: `transactionService.create/update/delete/duplicate` (with receipts since Phase 5: `create(db, clock, input, { receipts, add })`, `update(db, clock, id, patch, { receipts, add, remove })`, `delete(db, clock, id, receipts)`), `receiptService` (see below), `runHousekeepingIfDue` (orphan sweep at most every 7 days, `last_orphan_sweep_at`), `categoryService.create/update/setArchived/delete/move`, `dashboardService.getSummary(db, today)` (month totals, net, top 5 expense categories with whole-percent shares, last 5 non-future transactions, `hasAnyTransactions`).

Services implement use cases. They own transactions (`db.transaction`), call repositories, touch files/notifications through `src/platform` wrappers, and call `notifyChanged(tables)` after commit. Every write that changes user data also calls `markDataChanged(tx)` inside its DB transaction ([ARCHITECTURE.md](../02-architecture/ARCHITECTURE.md#tracking-changes-since-the-last-backup)). Caught errors are passed to `diagnosticsService.record`.

| Service | Function | Behaviour |
|---|---|---|
| `transactionService` | `create(input, receiptDrafts[])` | Validate → store receipt files → DB transaction inserting transaction + attachments + `markDataChanged` → on DB failure delete the stored files → `notifyChanged(['transactions','transaction_attachments'])` |
| | `update(id, patch, receiptChanges: { add: ReceiptDraft[]; remove: string[] })` | Validate (≤ 5 receipts after changes) → move added staged files into `receipts/` → one DB transaction: update row + insert added attachment rows + delete removed attachment rows + `markDataChanged` → commit → delete removed files. On DB failure delete the newly moved files; removed files stay untouched |
| | `duplicate(id): TransactionDraft` | Returns a form draft copying type, amount, category, payment method, description, notes; date = today; **no receipts**. Nothing is saved until the user saves the form |
| | `delete(id)` | DB delete (returns paths) → commit → delete files (errors ignored; sweep will retry) |
| `receiptService` | `prepareFromPicker(asset): ReceiptDraft` | Validate type/size → check free space → resize/compress into `cache/staging` → return draft (not yet persisted) |
| | `attach(transactionId, draft)` | Move staged file to `receipts/<id>.jpg` → insert row; delete file if insert fails |
| | `replace(attachmentId, draft)` | Write new file → in one DB transaction delete old row + insert new row → delete old file |
| | `remove(attachmentId)` | Delete row → delete file |
| | `resolveUri(relativePath): string \| null` | Validates path pattern; returns `null` if file missing |
| | `sweepOrphans()` | Delete files in `receipts/` not referenced in DB and older than 1 hour; clear `cache/staging` older than 1 day |
| | *As implemented (Phase 5)* | `createReceiptService({ files, images })` — file system and image processing are injected (`src/platform/receiptFiles.ts`, `images.ts`), so tests use fakes. Functions: `prepare(asset)`, `discard(drafts)`, `store(drafts)` (staging → `receipts/`), `unstore(stored, drafts)` (moves files back to staging if the DB write fails, so the form can retry), `deleteFiles(paths)`, `resolveUri(path)`, `replace(db, clock, attachmentId, draft)`, `remove(db, clock, attachmentId)`, `sweepOrphans(db, now)`. `attach` is not a separate function: the transaction service stores drafts on save |
| `udhaarService` | `previewBalanceAfter(personId, entryDraft, editingId?)` | Returns `{ before, after, flips: boolean }` for FR-4.6 |
| | `addEntry(input)` / `updateEntry` / `deleteEntry` | Validate (FR-4.12 no future dates) → write → `reminderService.reconcile()` |
| | `buildReminderMessage(personId): string` | Uses templates in `src/content/templates.ts` |
| | `openWhatsApp(personId)` / `openSms(personId)` / `shareReminder(personId)` | Uses phone if present, else share sheet |
| `reminderService` | `ensureChannel()` | Creates the Android notification channel `udhaar-reminders` ("Udhaar reminders", default importance). Called on startup before any scheduling |
| | `reconcile()` | Idempotent schedule of local notifications (ARCHITECTURE.md) |
| | `ensurePermission(): 'granted' \| 'denied'` | Asked only when needed |
| `dashboardService` | `getSummary(today): DashboardSummary` | Month totals, recent 5, top categories, budgets, udhaar totals, overdue/due-soon |
| `reportService` | `getReport(range, today): Report` | Totals, category breakdown, daily totals, upcoming |
| `exportService` | `transactionsCsv(range)` / `udhaarCsv()` | Writes to `cache/exports`, opens share sheet. Implemented (Phase 6): `createExportService(files).transactionsCsv(db, range \| null)` → `{ uri, fileName, rows }` or `null` when the range has no entries; oldest first; `null` range = all entries, named by the first and last dates; the screen opens the share sheet. `udhaarCsv` comes in Phase 7 |
| `backupService` | `create(): BackupResult` | See BACKUP_AND_RESTORE.md |
| | `inspect(fileUri): ValidationReport` | Stage + validate only; changes nothing |
| | `restore(report)` | Apply a validated staged backup |
| | `recoverIfInterrupted()` | Startup crash recovery |
| | *As implemented (Phase 6)* | `createBackupService({ files, sha256, sweepOrphans, appVersion, pauseAt? })`, app instance `src/services/backup/index.ts` (`pauseAt` only in debug builds, for the crash test). `create(db, clock): BackupResult { uri, fileName, sizeBytes, counts, missingFiles }` (file in `cache/exports`, the screen opens the share sheet) · `markBackedUp(db, clock)` (sheet closed) · `inspect(db, fileUri, 'file' \| 'undo'): ValidationReport` · `discard(report)` · `restore(db, clock, report)` · `recoverIfInterrupted(db, clock): 'none' \| 'finished' \| 'rolled-back'` (also clears leftover restore staging) · `safetyBackupUri()` · `estimateBackupBytes(db)`. Errors: `BACKUP_INVALID` with `detail` `NOT_BACKUP` / `NEWER_VERSION` / `DAMAGED` (the message names the failed check, never a value), `STORAGE_FULL`, `UNKNOWN` with `SAFETY_BACKUP_FAILED` / `RESTORE_FAILED`. Format and Zod schemas: `src/services/backup/format.ts`; cross-row checks: `integrity.ts`; schema upgrades: `upgrade.ts` |
| `backupNudgeService` | `get(db, now)` / `dismiss(db, clock)`; rule `backupNudgeFor(input, now)` | DASH-08 (Phase 6) |
| `dataService` | `deleteAllData()` | One DB transaction: delete all user tables (keep `schema_migrations` and device-only settings), reseed default categories, set `data_changed_since_backup = false` (`last_backup_at` kept) → then delete `receipts/`, `backups/` (pre-restore safety backups — otherwise "deleted" data would remain inside the app), `cache/staging/`, `cache/exports/` → cancel all reminders → `notifyChanged(all)`. Implemented (Phase 6) as `createDataService(files).deleteAllData(db, clock)`; also removes `receipts-incoming/`, `receipts-old/`, and a restore journal; also clears `backup_nudge_dismissed_until`. Reminders join in Phase 7 |
| `appLockService` | `isAvailable()` / `authenticate()` / `shouldLock(lastBackgroundAt, now)` | |
| | `runWithoutLock(fn)` | Wraps calls that open a system screen (camera, gallery, document picker, share sheet, WhatsApp/SMS link). Returning within 5 minutes does not lock (ADR-016) |
| | `applySecureFlag(enabled)` | Sets/clears the secure flag with `expo-screen-capture` when app lock is turned on/off |
| `diagnosticsService` | `record(error, where)` / `entries()` / `buildReport(info): Promise<string>` | Local error log (last 50, `code` + `detail` + `where` only) and a shareable report without personal data (ARCHITECTURE.md § Diagnostics). Built by `createDiagnosticsService({ files, clock, appVersion })`; the app instance is `src/services/diagnostics.ts`. Implemented in Phase 3 |
| `startupService` | `startDatabase(clock): Promise<{ db, schemaVersion }>` | Startup steps 1–5 (step 5, restore recovery, since Phase 6); records failures in diagnostics. Phase 3 |

## Pure libraries (`src/lib`) — must have unit tests

| Module | Functions |
|---|---|
| `money.ts` | `parseRupeesToPaise(text): { ok: true, value } \| { ok: false, error: 'amount.required' \| 'amount.zero' \| 'amount.decimals' \| 'amount.max' \| 'amount.invalid' }`, `formatPaise(p, { compact?, sign? })` (negatives get "−"), `paiseToRupeeString(p)` (CSV: `1234.50`), `assertPaise(n)` |
| `dates.ts` | `todayLocal(now)`, `isValidLocalDate(s)`, `monthRange(date)`, `weekRange(date, weekStart)`, `addDays`, `dayOfWeek`, `daysInRange`, `shiftPeriod(range, kind, ±n)`, `makeRange(start, end)` (validated custom range), `clampEndToToday(range, today)` (null if fully future), `formatLocalDate(s, 'long' \| 'short' \| 'list', today?)`, `formatMonthYear`, `isFuture(date, today)`, `toIsoDateTime(now)`. Calendar maths uses UTC day numbers, so only `todayLocal` depends on the timezone |
| `clock.ts` | `Clock { now(): Date }`, `systemClock`. Business code never calls `Date.now()` |
| `balance.ts` | `signedAmount(entry)`, `balanceOf(entries)`, `runningBalances(entriesAsc)`, `balanceLabel(balance): 'will_get' \| 'owe' \| 'settled'`, `wouldFlip(before, entry)` |
| `budget.ts` | `budgetProgress(spent, budget): { percent, remaining, state: 'normal' \| 'warning' \| 'over' }` |
| `csv.ts` | `toCsv(headers, rows)` with RFC 4180 escaping and UTF-8 BOM; formula-injection guard (prefix `'` to cells starting with `= + - @`, and also tab / carriage return). Numbers are written as-is |
| `zip/zipWriter.ts` | `createZipWriter(sink, modified)` → `addStored(name, bytes)`, `addDeflated(name, bytes)`, `finish()`; fflate `Zip`, one entry in memory at a time |
| `zip/zipReader.ts` | `readZipDirectory(source, { maxEntries })` (central directory; rejects ZIP64, encryption, multi-disk, out-of-range entries), `entryDataOffset(source, entry)` (checks the local header matches), `ZipFormatError` |
| `ids.ts` | `newId()`, `isUuid(s)` |
| `paths.ts` | `receiptRelativePath(id)`, `isSafeReceiptPath(s)` (regex `^receipts/[0-9a-f-]{36}\.jpg$`), `toAbsolute(rel)` |
| `errors.ts` | `AppError(code, message, { detail?, cause? })`, `isAppError`, `toAppError` |

## Hooks (`src/hooks`, `src/features/*/hooks`)

| Hook | Purpose |
|---|---|
| `useDbQuery(fn, deps, { tables })` | Read + auto-refresh on `notifyChanged`; returns `{ status: 'loading' \| 'success' \| 'error', data?, error?, reload }`. Phase 3 |
| `useDb()` / `DatabaseProvider` | The started `DbClient` (provided by `StartupGate`). Phase 3 |
| `useToday()` | Local date; updates when the app returns to foreground or the date changes |
| `useAppLock()` | Lock gate state |
| Feature hooks, e.g. `useTransactions(filter)`, `usePersonLedger(id)`, `useDashboard()` | Thin wrappers over services/repos |
