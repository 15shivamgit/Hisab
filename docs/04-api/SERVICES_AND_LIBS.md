# Internal API — Services and Pure Libraries

Status: Approved · Last updated: 2026-10-21

## Services (`src/services`)

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
| `udhaarService` | `previewBalanceAfter(personId, entryDraft, editingId?)` | Returns `{ before, after, flips: boolean }` for FR-4.6 |
| | `addEntry(input)` / `updateEntry` / `deleteEntry` | Validate (FR-4.12 no future dates) → write → `reminderService.reconcile()` |
| | `buildReminderMessage(personId): string` | Uses templates in `src/content/templates.ts` |
| | `openWhatsApp(personId)` / `openSms(personId)` / `shareReminder(personId)` | Uses phone if present, else share sheet |
| `reminderService` | `ensureChannel()` | Creates the Android notification channel `udhaar-reminders` ("Udhaar reminders", default importance). Called on startup before any scheduling |
| | `reconcile()` | Idempotent schedule of local notifications (ARCHITECTURE.md) |
| | `ensurePermission(): 'granted' \| 'denied'` | Asked only when needed |
| `dashboardService` | `getSummary(today): DashboardSummary` | Month totals, recent 5, top categories, budgets, udhaar totals, overdue/due-soon |
| `reportService` | `getReport(range, today): Report` | Totals, category breakdown, daily totals, upcoming |
| `exportService` | `transactionsCsv(range)` / `udhaarCsv()` | Writes to `cache/exports`, opens share sheet |
| `backupService` | `create(): BackupResult` | See BACKUP_AND_RESTORE.md |
| | `inspect(fileUri): ValidationReport` | Stage + validate only; changes nothing |
| | `restore(report)` | Apply a validated staged backup |
| | `recoverIfInterrupted()` | Startup crash recovery |
| `dataService` | `deleteAllData()` | One DB transaction: delete all user tables (keep `schema_migrations` and device-only settings), reseed default categories, set `data_changed_since_backup = false` (`last_backup_at` kept) → then delete `receipts/`, `backups/` (pre-restore safety backups — otherwise "deleted" data would remain inside the app), `cache/staging/`, `cache/exports/` → cancel all reminders → `notifyChanged(all)` |
| `appLockService` | `isAvailable()` / `authenticate()` / `shouldLock(lastBackgroundAt, now)` | |
| | `runWithoutLock(fn)` | Wraps calls that open a system screen (camera, gallery, document picker, share sheet, WhatsApp/SMS link). Returning within 5 minutes does not lock (ADR-016) |
| | `applySecureFlag(enabled)` | Sets/clears the secure flag with `expo-screen-capture` when app lock is turned on/off |
| `diagnosticsService` | `record(error)` / `buildReport(): string` | Local error log and copyable report without personal data (ARCHITECTURE.md § Diagnostics) |

## Pure libraries (`src/lib`) — must have unit tests

| Module | Functions |
|---|---|
| `money.ts` | `parseRupeesToPaise(text): Result<Paise>`, `formatPaise(p, { compact?, sign? })`, `paiseToRupeeString(p)` (CSV: `1234.50`), `assertPaise(n)` |
| `dates.ts` | `todayLocal(now?)`, `isValidLocalDate(s)`, `monthRange(date)`, `weekRange(date, weekStart)`, `addDays`, `shiftPeriod(range, kind, ±1)`, `clampEndToToday(range, today)`, `formatLocalDate(s, style)`, `isFuture(date, today)` |
| `balance.ts` | `signedAmount(entry)`, `balanceOf(entries)`, `runningBalances(entriesAsc)`, `balanceLabel(balance): 'will_get' \| 'owe' \| 'settled'`, `wouldFlip(before, entry)` |
| `budget.ts` | `budgetProgress(spent, budget): { percent, remaining, state: 'normal' \| 'warning' \| 'over' }` |
| `csv.ts` | `toCsv(headers, rows)` with RFC 4180 escaping and UTF-8 BOM; formula-injection guard (prefix `'` to cells starting with `= + - @`) |
| `ids.ts` | `newId()`, `isUuid(s)` |
| `paths.ts` | `receiptRelativePath(id)`, `isSafeReceiptPath(s)` (regex `^receipts/[0-9a-f-]{36}\.jpg$`), `toAbsolute(rel)` |
| `errors.ts` | `AppError`, `isAppError`, code enum |

## Hooks (`src/hooks`, `src/features/*/hooks`)

| Hook | Purpose |
|---|---|
| `useDbQuery(fn, deps, { tables })` | Read + auto-refresh on `notifyChanged` |
| `useToday()` | Local date; updates when the app returns to foreground or the date changes |
| `useAppLock()` | Lock gate state |
| Feature hooks, e.g. `useTransactions(filter)`, `usePersonLedger(id)`, `useDashboard()` | Thin wrappers over services/repos |
