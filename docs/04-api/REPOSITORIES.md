# Internal API — Repositories

Status: Approved (signatures may be refined in Phase 3; update this doc when they change) · Last updated: 2026-10-21

> Hisaab has **no network API**. This folder documents the internal data API that screens and services use.

Repositories are the only code that contains SQL. Each takes a `DbClient` (so it works inside a transaction) and returns domain models (camelCase), never raw rows.

## Shared types (`src/db/types.ts`)

```ts
type Paise = number;          // integer
type LocalDate = string;      // 'YYYY-MM-DD'
type IsoDateTime = string;    // UTC ISO 8601
type TxnType = 'income' | 'expense';
type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'card' | 'other';
type UdhaarDirection = 'gave' | 'got';
interface DateRange { start: LocalDate; end: LocalDate }   // inclusive
interface Page { limit: number; offset: number }
```

## `categoryRepository`

| Function | Notes |
|---|---|
| `list(db, { type?, includeArchived? }): Category[]` | Ordered by `sort_order`, then name |
| `getById(db, id): Category \| null` | |
| `create(db, input): Category` | Throws `CONSTRAINT` on duplicate name per type |
| `update(db, id, patch): Category` | Type cannot change if the category has transactions or a budget (also enforced by trigger). Name cannot change if `is_system` (icon/colour can) |
| `setArchived(db, id, archived: boolean)` | Throws if `is_system` |
| `usage(db, id): { transactions: number; budgets: number }` | Transaction count is shown on the categories screen |
| `delete(db, id)` | Throws `IN_USE` if `transactions > 0`, or if `is_system`. Its budget, if any, is removed by `ON DELETE CASCADE` |
| `seedDefaultsIfEmpty(db, now)` | Idempotent |

## `transactionRepository`

| Function | Notes |
|---|---|
| `list(db, filter: TxnFilter, page: Page): TransactionListItem[]` | Includes category name/icon/colour and `attachmentCount` |
| `getById(db, id): TransactionDetail \| null` | Includes attachments |
| `create(db, input): Transaction` | |
| `update(db, id, patch): Transaction` | Sets `updated_at` |
| `delete(db, id): { attachmentPaths: string[] }` | Returns paths so the service can delete files after commit |
| `sumByType(db, range, today): { incomePaise, expensePaise }` | Applies `min(end, today)` (FR-3.1) |
| `sumByCategory(db, range, type, today): { categoryId, totalPaise, count }[]` | Sorted desc |
| `dailyTotals(db, range, today): { date, incomePaise, expensePaise }[]` | For trend charts |
| `upcomingInRange(db, range, today): { incomePaise, expensePaise, count }` | Future-dated within range |

```ts
interface TxnFilter {
  type?: TxnType;
  categoryIds?: string[];
  paymentMethods?: PaymentMethod[];
  range?: DateRange;
  search?: string;                 // matches description OR notes (case-insensitive LIKE, escaped),
                                   // OR amount_paise = parseRupeesToPaise(search) when it parses as an amount
  sort?: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';   // allowlist → ORDER BY
}
```

## `attachmentRepository`

| Function | Notes |
|---|---|
| `listByTransaction(db, transactionId): Attachment[]` | |
| `insert(db, input): Attachment` | Throws if the transaction already has 5 |
| `delete(db, id): { relativePath: string }` | |
| `reorder(db, transactionId, orderedIds)` | |
| `allRelativePaths(db): Set<string>` | For orphan sweep and backup |

## `personRepository`

| Function | Notes |
|---|---|
| `listWithBalances(db, { search?, filter?, sort?, includeArchived? }, today): PersonWithBalance[]` | `filter`: `all \| will_get \| owe \| settled \| overdue`; `sort`: `amount_desc \| name_asc \| recent` |
| `getWithBalance(db, id, today): PersonWithBalance \| null` | Includes `isOverdue`, `isDueSoon` |
| `create(db, input): Person` | |
| `update(db, id, patch): Person` | Includes `returnByDate` |
| `setArchived(db, id, archived)` | Throws if balance ≠ 0 when archiving |
| `delete(db, id)` | Throws `IN_USE` if any entries exist |
| `reminderCandidates(db, today): { personId, name, balancePaise, returnByDate }[]` | `return_by_date ≥ today` and balance ≠ 0 |

## `udhaarRepository`

| Function | Notes |
|---|---|
| `listByPerson(db, personId): UdhaarEntryWithRunningBalance[]` | Ordered oldest→newest to compute running balance, returned newest first |
| `getById(db, id): UdhaarEntry \| null` | |
| `create(db, input): UdhaarEntry` | |
| `update(db, id, patch): UdhaarEntry` | |
| `delete(db, id)` | |
| `totals(db): { youWillGetPaise, willGetCount, youOwePaise, oweCount }` | FR-4.9, archived people included if balance ≠ 0 (cannot archive non-zero anyway) |
| `listAll(db, range?): UdhaarEntryWithPerson[]` | For CSV |

## `budgetRepository`

| Function | Notes |
|---|---|
| `list(db): Budget[]` | Overall first |
| `upsertOverall(db, amountPaise)` | |
| `upsertForCategory(db, categoryId, amountPaise)` | Expense categories only |
| `delete(db, id)` | |

## `settingsRepository`

| Function | Notes |
|---|---|
| `get<K extends SettingKey>(db, key): SettingValue<K>` | Returns default if missing; validates with Zod |
| `set<K>(db, key, value)` | |
| `getAll(db): Settings` | |
| `portableEntries(db)` / `replacePortable(db, entries)` | For backup/restore (device-only keys untouched) |

## `backupRepository` (raw table access for backup/restore)

| Function | Notes |
|---|---|
| `dumpAll(db): BackupData` | All tables except `schema_migrations` and device-only settings |
| `replaceAll(db, data: BackupData)` | Must be called inside a transaction; deletes children → parents, inserts parents → children |
| `integrityReport(db): { fkViolations: number }` | `PRAGMA foreign_key_check` |
