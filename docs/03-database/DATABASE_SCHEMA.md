# Database Schema

Status: Approved · Last updated: 2026-10-21

SQLite via `expo-sqlite`. Database file: `hisaab.db`. Every connection runs `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL`.

## Conventions

| Item | Rule |
|---|---|
| IDs | `TEXT` UUID v4 from `expo-crypto.randomUUID()` (lowercase, with hyphens) |
| Money | `INTEGER` paise, `CHECK (amount_paise > 0 AND amount_paise <= 1000000000)` |
| Business dates | `TEXT` `YYYY-MM-DD`, `CHECK (x GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')`; real calendar validity checked in app code |
| Timestamps | `TEXT` UTC ISO 8601, set by app code |
| Booleans | `INTEGER` 0/1 with `CHECK` |
| Enums | `TEXT` with `CHECK (x IN (...))` |
| Soft-hide | `archived_at TEXT NULL` (categories, people). Transactions and udhaar entries are hard-deleted after confirmation. |

## Tables

### `schema_migrations`

```sql
CREATE TABLE schema_migrations (
  version     INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  applied_at  TEXT    NOT NULL
);
```

### `app_settings`

```sql
CREATE TABLE app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,          -- JSON-encoded
  updated_at  TEXT NOT NULL
);
```

Known keys (validated by a Zod schema in `settingsRepository`):

| Key | Type | Default | In backup? |
|---|---|---|---|
| `theme` | `'system' \| 'light' \| 'dark'` | `'system'` | Yes |
| `week_start` | `'monday' \| 'sunday'` | `'monday'` | Yes |
| `reminders_enabled` | boolean | `true` | Yes |
| `reminder_time` | `'HH:mm'` | `'09:00'` | Yes |
| `app_lock_enabled` | boolean | `false` | **No** (device-specific) |
| `app_lock_timeout_seconds` | `0 \| 30 \| 60 \| 300` | `60` | **No** |
| `onboarding_completed` | boolean | `false` | **No** |
| `last_backup_at` | ISO timestamp \| null | `null` | **No** |
| `data_changed_since_backup` | boolean | `false` | **No** |
| `backup_nudge_dismissed_until` | `LocalDate` \| null | `null` | **No** |
| `last_orphan_sweep_at` | ISO timestamp \| null | `null` | **No** |
| `restore_marker` | staging ID string \| null | `null` | **No** — written inside the restore DB transaction for crash recovery (BACKUP_AND_RESTORE.md) |

Device-specific keys are kept as-is during restore.

### `categories`

```sql
CREATE TABLE categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 30),
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  icon        TEXT NOT NULL,            -- icon name from the app's icon set
  color       TEXT NOT NULL,            -- token name, e.g. 'cat.orange'
  is_system   INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),  -- 1 = "Other", cannot delete/archive
  sort_order  INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_categories_type_name ON categories (type, name COLLATE NOCASE);
```

### `transactions`

```sql
CREATE TABLE transactions (
  id              TEXT PRIMARY KEY,
  type            TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
  amount_paise    INTEGER NOT NULL CHECK (amount_paise > 0 AND amount_paise <= 1000000000),
  category_id     TEXT    NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  txn_date        TEXT    NOT NULL CHECK (txn_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  payment_method  TEXT    NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'card', 'other')),
  description     TEXT    CHECK (description IS NULL OR length(description) <= 100),
  notes           TEXT    CHECK (notes IS NULL OR length(notes) <= 1000),
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);
CREATE INDEX ix_transactions_date          ON transactions (txn_date DESC, created_at DESC);
CREATE INDEX ix_transactions_type_date     ON transactions (type, txn_date);
CREATE INDEX ix_transactions_category_date ON transactions (category_id, txn_date);

-- Category type must match transaction type (also checked in the repository).
CREATE TRIGGER trg_transactions_category_type_ins
BEFORE INSERT ON transactions
WHEN (SELECT type FROM categories WHERE id = NEW.category_id) IS NOT NEW.type
BEGIN SELECT RAISE(ABORT, 'CATEGORY_TYPE_MISMATCH'); END;

CREATE TRIGGER trg_transactions_category_type_upd
BEFORE UPDATE OF type, category_id ON transactions
WHEN (SELECT type FROM categories WHERE id = NEW.category_id) IS NOT NEW.type
BEGIN SELECT RAISE(ABORT, 'CATEGORY_TYPE_MISMATCH'); END;
```

### `transaction_attachments`

```sql
CREATE TABLE transaction_attachments (
  id              TEXT PRIMARY KEY,
  transaction_id  TEXT    NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
  relative_path   TEXT    NOT NULL UNIQUE,       -- 'receipts/<id>.jpg'
  mime_type       TEXT    NOT NULL CHECK (mime_type = 'image/jpeg'),
  size_bytes      INTEGER NOT NULL CHECK (size_bytes > 0),
  width           INTEGER NOT NULL CHECK (width > 0),
  height          INTEGER NOT NULL CHECK (height > 0),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL
);
CREATE INDEX ix_attachments_transaction ON transaction_attachments (transaction_id, sort_order);
```

`ON DELETE CASCADE` removes rows only. Files are removed by `receiptService` (it reads the paths before deleting) and by the orphan sweep as a safety net.

### `people`

```sql
CREATE TABLE people (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  phone           TEXT CHECK (phone IS NULL OR length(phone) BETWEEN 6 AND 20),  -- digits and optional leading +
  notes           TEXT CHECK (notes IS NULL OR length(notes) <= 500),
  return_by_date  TEXT CHECK (return_by_date IS NULL OR return_by_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  archived_at     TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX ix_people_name ON people (name COLLATE NOCASE);
```

Names are **not** unique (two friends can be called Rahul). The UI warns on an exact duplicate name and suggests adding a phone or note.

### `udhaar_entries`

```sql
CREATE TABLE udhaar_entries (
  id              TEXT PRIMARY KEY,
  person_id       TEXT    NOT NULL REFERENCES people (id) ON DELETE RESTRICT,
  direction       TEXT    NOT NULL CHECK (direction IN ('gave', 'got')),
  amount_paise    INTEGER NOT NULL CHECK (amount_paise > 0 AND amount_paise <= 1000000000),
  entry_date      TEXT    NOT NULL CHECK (entry_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  payment_method  TEXT    NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'card', 'other')),
  note            TEXT    CHECK (note IS NULL OR length(note) <= 500),
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);
CREATE INDEX ix_udhaar_person_date ON udhaar_entries (person_id, entry_date, created_at);
CREATE INDEX ix_udhaar_date        ON udhaar_entries (entry_date);
```

### `budgets`

```sql
CREATE TABLE budgets (
  id            TEXT PRIMARY KEY,
  category_id   TEXT    REFERENCES categories (id) ON DELETE CASCADE,  -- NULL = overall budget
  amount_paise  INTEGER NOT NULL CHECK (amount_paise > 0 AND amount_paise <= 1000000000),
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);
CREATE UNIQUE INDEX ux_budgets_overall  ON budgets ((1)) WHERE category_id IS NULL;
CREATE UNIQUE INDEX ux_budgets_category ON budgets (category_id) WHERE category_id IS NOT NULL;

CREATE TRIGGER trg_budgets_expense_only
BEFORE INSERT ON budgets
WHEN NEW.category_id IS NOT NULL
 AND (SELECT type FROM categories WHERE id = NEW.category_id) IS NOT 'expense'
BEGIN SELECT RAISE(ABORT, 'BUDGET_CATEGORY_NOT_EXPENSE'); END;
-- Plus a matching BEFORE UPDATE OF category_id trigger with the same condition.

-- A category's type cannot change once it has transactions or a budget (also checked in the repository).
-- Created after `transactions` and `budgets` in the migration.
CREATE TRIGGER trg_categories_type_locked
BEFORE UPDATE OF type ON categories
WHEN NEW.type IS NOT OLD.type
 AND (EXISTS (SELECT 1 FROM transactions WHERE category_id = OLD.id)
      OR EXISTS (SELECT 1 FROM budgets WHERE category_id = OLD.id))
BEGIN SELECT RAISE(ABORT, 'CATEGORY_IN_USE'); END;
```

Verified 2026-10-22: the `ON budgets ((1)) WHERE …` index rejects a second overall budget in better-sqlite3 (SQLite 3.53.4) — test "the DB itself allows only one overall budget". On the device it is created by migration 1 at startup (Phase 3 device check). `budgetRepository.upsertOverall` also updates instead of inserting.

## Deletion rules summary

| Parent → child | Rule | Reason |
|---|---|---|
| categories → transactions | RESTRICT | Archive instead (CAT-04) |
| categories → budgets | CASCADE | Only reachable when the category is unused and deleted |
| transactions → attachments | CASCADE (rows) + service deletes files | TXN-03 |
| people → udhaar_entries | RESTRICT | Person with history can only be archived (UDH-11) |

## Key queries (reference)

```sql
-- Balance per person (FR-4.2)
SELECT p.id, p.name,
       COALESCE(SUM(CASE e.direction WHEN 'gave' THEN e.amount_paise ELSE -e.amount_paise END), 0) AS balance_paise
FROM people p
LEFT JOIN udhaar_entries e ON e.person_id = p.id
WHERE p.archived_at IS NULL
GROUP BY p.id;

-- Month expense, excluding future-dated (FR-3.1, FR-3.2)
SELECT COALESCE(SUM(amount_paise), 0)
FROM transactions
WHERE type = 'expense' AND txn_date BETWEEN :start AND :effectiveEnd;  -- effectiveEnd = min(end, today)
```

## Optional future tables

`accounts`, `recurring_rules` — not created in v1. Will need a new ADR.
