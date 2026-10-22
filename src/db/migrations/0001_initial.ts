// Migration 1 — Phase 3. Tables: app_settings, categories, transactions,
// transaction_attachments, budgets (DATABASE_SCHEMA.md). schema_migrations is
// created by the runner. People and udhaar come in migration 2 (Phase 7).

import type { Migration } from '@/db/migrations/types';

const DATE_GLOB = "GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'";
const AMOUNT_CHECK = 'CHECK (amount_paise > 0 AND amount_paise <= 1000000000)';
const PAYMENT_METHOD_CHECK =
  "CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'card', 'other'))";

export const migration0001: Migration = {
  version: 1,
  name: 'initial',
  statements: [
    `CREATE TABLE app_settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    )`,

    `CREATE TABLE categories (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 30),
      type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      icon        TEXT NOT NULL,
      color       TEXT NOT NULL,
      is_system   INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
      sort_order  INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    )`,
    `CREATE UNIQUE INDEX ux_categories_type_name ON categories (type, name COLLATE NOCASE)`,

    `CREATE TABLE transactions (
      id              TEXT PRIMARY KEY,
      type            TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
      amount_paise    INTEGER NOT NULL ${AMOUNT_CHECK},
      category_id     TEXT    NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
      txn_date        TEXT    NOT NULL CHECK (txn_date ${DATE_GLOB}),
      payment_method  TEXT    NOT NULL ${PAYMENT_METHOD_CHECK},
      description     TEXT    CHECK (description IS NULL OR length(description) <= 100),
      notes           TEXT    CHECK (notes IS NULL OR length(notes) <= 1000),
      created_at      TEXT    NOT NULL,
      updated_at      TEXT    NOT NULL
    )`,
    `CREATE INDEX ix_transactions_date ON transactions (txn_date DESC, created_at DESC)`,
    `CREATE INDEX ix_transactions_type_date ON transactions (type, txn_date)`,
    `CREATE INDEX ix_transactions_category_date ON transactions (category_id, txn_date)`,
    `CREATE TRIGGER trg_transactions_category_type_ins
      BEFORE INSERT ON transactions
      WHEN (SELECT type FROM categories WHERE id = NEW.category_id) IS NOT NEW.type
      BEGIN SELECT RAISE(ABORT, 'CATEGORY_TYPE_MISMATCH'); END`,
    `CREATE TRIGGER trg_transactions_category_type_upd
      BEFORE UPDATE OF type, category_id ON transactions
      WHEN (SELECT type FROM categories WHERE id = NEW.category_id) IS NOT NEW.type
      BEGIN SELECT RAISE(ABORT, 'CATEGORY_TYPE_MISMATCH'); END`,

    `CREATE TABLE transaction_attachments (
      id              TEXT PRIMARY KEY,
      transaction_id  TEXT    NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
      relative_path   TEXT    NOT NULL UNIQUE,
      mime_type       TEXT    NOT NULL CHECK (mime_type = 'image/jpeg'),
      size_bytes      INTEGER NOT NULL CHECK (size_bytes > 0),
      width           INTEGER NOT NULL CHECK (width > 0),
      height          INTEGER NOT NULL CHECK (height > 0),
      sort_order      INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL
    )`,
    `CREATE INDEX ix_attachments_transaction ON transaction_attachments (transaction_id, sort_order)`,

    `CREATE TABLE budgets (
      id            TEXT PRIMARY KEY,
      category_id   TEXT    REFERENCES categories (id) ON DELETE CASCADE,
      amount_paise  INTEGER NOT NULL ${AMOUNT_CHECK},
      created_at    TEXT    NOT NULL,
      updated_at    TEXT    NOT NULL
    )`,
    `CREATE UNIQUE INDEX ux_budgets_overall ON budgets ((1)) WHERE category_id IS NULL`,
    `CREATE UNIQUE INDEX ux_budgets_category ON budgets (category_id) WHERE category_id IS NOT NULL`,
    `CREATE TRIGGER trg_budgets_expense_only_ins
      BEFORE INSERT ON budgets
      WHEN NEW.category_id IS NOT NULL
       AND (SELECT type FROM categories WHERE id = NEW.category_id) IS NOT 'expense'
      BEGIN SELECT RAISE(ABORT, 'BUDGET_CATEGORY_NOT_EXPENSE'); END`,
    `CREATE TRIGGER trg_budgets_expense_only_upd
      BEFORE UPDATE OF category_id ON budgets
      WHEN NEW.category_id IS NOT NULL
       AND (SELECT type FROM categories WHERE id = NEW.category_id) IS NOT 'expense'
      BEGIN SELECT RAISE(ABORT, 'BUDGET_CATEGORY_NOT_EXPENSE'); END`,

    `CREATE TRIGGER trg_categories_type_locked
      BEFORE UPDATE OF type ON categories
      WHEN NEW.type IS NOT OLD.type
       AND (EXISTS (SELECT 1 FROM transactions WHERE category_id = OLD.id)
            OR EXISTS (SELECT 1 FROM budgets WHERE category_id = OLD.id))
      BEGIN SELECT RAISE(ABORT, 'CATEGORY_IN_USE'); END`,
  ],
};
