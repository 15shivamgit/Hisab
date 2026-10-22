// Monthly budgets (BUDGETS.md, BUD-01…04). One overall budget (category_id NULL)
// and at most one per expense category; the DB enforces both.

import type { DbClient } from '@/db/client';
import { mapSqliteError } from '@/db/sqlErrors';
import type { Budget, Paise } from '@/db/types';
import { toIsoDateTime } from '@/lib/dates';
import { AppError } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { assertPaise } from '@/lib/money';

interface BudgetRow {
  id: string;
  category_id: string | null;
  amount_paise: number;
  created_at: string;
  updated_at: string;
}

const toBudget = (row: BudgetRow): Budget => ({
  id: row.id,
  categoryId: row.category_id,
  amountPaise: row.amount_paise,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

function mapBudgetError(error: unknown): unknown {
  const mapped = mapSqliteError(error, 'BUDGET_DUPLICATE');
  if (mapped instanceof AppError && mapped.detail === 'FOREIGN_KEY') {
    return new AppError('VALIDATION', 'Category does not exist', {
      detail: 'CATEGORY_NOT_FOUND',
      cause: error,
    });
  }
  return mapped;
}

async function upsert(
  db: DbClient,
  categoryId: string | null,
  amountPaise: Paise,
  now: Date,
): Promise<Budget> {
  assertPaise(amountPaise);
  if (categoryId !== null) {
    // Checked here for a clear error; the expense-only trigger runs before the FK check.
    const category = await db.get<{ type: string }>('SELECT type FROM categories WHERE id = ?', [
      categoryId,
    ]);
    if (!category) {
      throw new AppError('VALIDATION', 'Category does not exist', {
        detail: 'CATEGORY_NOT_FOUND',
      });
    }
    if (category.type !== 'expense') {
      throw new AppError('VALIDATION', 'Budgets are only for expense categories', {
        detail: 'BUDGET_CATEGORY_NOT_EXPENSE',
      });
    }
  }
  const ts = toIsoDateTime(now);
  const existing = await db.get<BudgetRow>(
    categoryId === null
      ? 'SELECT * FROM budgets WHERE category_id IS NULL'
      : 'SELECT * FROM budgets WHERE category_id = ?',
    categoryId === null ? [] : [categoryId],
  );
  const id = existing?.id ?? newId();
  try {
    if (existing) {
      await db.run('UPDATE budgets SET amount_paise = ?, updated_at = ? WHERE id = ?', [
        amountPaise,
        ts,
        id,
      ]);
    } else {
      await db.run(
        'INSERT INTO budgets (id, category_id, amount_paise, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [id, categoryId, amountPaise, ts, ts],
      );
    }
  } catch (error) {
    throw mapBudgetError(error);
  }
  const row = await db.get<BudgetRow>('SELECT * FROM budgets WHERE id = ?', [id]);
  if (!row) throw new AppError('UNKNOWN', 'Budget write not visible');
  return toBudget(row);
}

export const budgetRepository = {
  /** Overall budget first, then category budgets in creation order. */
  async list(db: DbClient): Promise<Budget[]> {
    const rows = await db.all<BudgetRow>(
      'SELECT * FROM budgets ORDER BY category_id IS NOT NULL, created_at, id',
    );
    return rows.map(toBudget);
  },

  upsertOverall(db: DbClient, amountPaise: Paise, now: Date): Promise<Budget> {
    return upsert(db, null, amountPaise, now);
  },

  /** Expense categories only (trigger trg_budgets_expense_only_*). */
  upsertForCategory(
    db: DbClient,
    categoryId: string,
    amountPaise: Paise,
    now: Date,
  ): Promise<Budget> {
    return upsert(db, categoryId, amountPaise, now);
  },

  async delete(db: DbClient, id: string): Promise<void> {
    const { changes } = await db.run('DELETE FROM budgets WHERE id = ?', [id]);
    if (changes === 0) throw new AppError('NOT_FOUND', 'Budget not found', { detail: 'BUDGET' });
  },
};
