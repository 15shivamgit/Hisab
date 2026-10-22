// Categories (CATEGORIES.md, CAT-01…05).

import type { DbClient } from '@/db/client';
import { DEFAULT_CATEGORIES } from '@/db/seed/defaultCategories';
import { mapSqliteError } from '@/db/sqlErrors';
import { TXN_TYPES, type Category, type TxnType } from '@/db/types';
import { toIsoDateTime } from '@/lib/dates';
import { AppError } from '@/lib/errors';
import { newId } from '@/lib/ids';

interface CategoryRow {
  id: string;
  name: string;
  type: TxnType;
  icon: string;
  color: string;
  is_system: number;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

const toCategory = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  type: row.type,
  icon: row.icon,
  color: row.color,
  isSystem: row.is_system === 1,
  sortOrder: row.sort_order,
  archivedAt: row.archived_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export interface NewCategory {
  name: string;
  type: TxnType;
  icon: string;
  color: string;
  isSystem?: boolean;
  sortOrder?: number;
}

export interface CategoryPatch {
  name?: string;
  type?: TxnType;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 30) {
    throw new AppError('VALIDATION', 'Category name must be 1–30 characters', {
      detail: 'CATEGORY_NAME_LENGTH',
    });
  }
  return trimmed;
}

function assertType(type: string): asserts type is TxnType {
  if (!TXN_TYPES.includes(type as TxnType)) {
    throw new AppError('VALIDATION', 'Unknown category type', { detail: 'CATEGORY_TYPE' });
  }
}

async function requireCategory(db: DbClient, id: string): Promise<Category> {
  const category = await categoryRepository.getById(db, id);
  if (!category) throw new AppError('NOT_FOUND', 'Category not found', { detail: 'CATEGORY' });
  return category;
}

export const categoryRepository = {
  async list(
    db: DbClient,
    options: { type?: TxnType; includeArchived?: boolean } = {},
  ): Promise<Category[]> {
    const where: string[] = [];
    const params: string[] = [];
    if (options.type) {
      where.push('type = ?');
      params.push(options.type);
    }
    if (!options.includeArchived) where.push('archived_at IS NULL');
    const rows = await db.all<CategoryRow>(
      `SELECT * FROM categories ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY sort_order, name COLLATE NOCASE`,
      params,
    );
    return rows.map(toCategory);
  },

  async getById(db: DbClient, id: string): Promise<Category | null> {
    const row = await db.get<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]);
    return row ? toCategory(row) : null;
  },

  async create(db: DbClient, input: NewCategory, now: Date): Promise<Category> {
    const name = cleanName(input.name);
    assertType(input.type);
    const id = newId();
    const ts = toIsoDateTime(now);
    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const row = await db.get<{ next: number }>(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM categories WHERE type = ?',
        [input.type],
      );
      sortOrder = row?.next ?? 0;
    }
    try {
      await db.run(
        `INSERT INTO categories (id, name, type, icon, color, is_system, sort_order, archived_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        [id, name, input.type, input.icon, input.color, input.isSystem ? 1 : 0, sortOrder, ts, ts],
      );
    } catch (error) {
      throw mapSqliteError(error, 'CATEGORY_DUPLICATE');
    }
    return requireCategory(db, id);
  },

  async update(db: DbClient, id: string, patch: CategoryPatch, now: Date): Promise<Category> {
    const current = await requireCategory(db, id);
    const name = patch.name === undefined ? current.name : cleanName(patch.name);
    if (current.isSystem && name !== current.name) {
      throw new AppError('VALIDATION', 'The Other category cannot be renamed', {
        detail: 'SYSTEM_CATEGORY',
      });
    }
    const type = patch.type ?? current.type;
    assertType(type);
    try {
      await db.run(
        `UPDATE categories SET name = ?, type = ?, icon = ?, color = ?, sort_order = ?, updated_at = ?
         WHERE id = ?`,
        [
          name,
          type,
          patch.icon ?? current.icon,
          patch.color ?? current.color,
          patch.sortOrder ?? current.sortOrder,
          toIsoDateTime(now),
          id,
        ],
      );
    } catch (error) {
      throw mapSqliteError(error, 'CATEGORY_DUPLICATE');
    }
    return requireCategory(db, id);
  },

  async setArchived(db: DbClient, id: string, archived: boolean, now: Date): Promise<Category> {
    const current = await requireCategory(db, id);
    if (current.isSystem) {
      throw new AppError('VALIDATION', 'The Other category cannot be archived', {
        detail: 'SYSTEM_CATEGORY',
      });
    }
    const ts = toIsoDateTime(now);
    await db.run('UPDATE categories SET archived_at = ?, updated_at = ? WHERE id = ?', [
      archived ? ts : null,
      ts,
      id,
    ]);
    return requireCategory(db, id);
  },

  async usage(db: DbClient, id: string): Promise<{ transactions: number; budgets: number }> {
    const row = await db.get<{ transactions: number; budgets: number }>(
      `SELECT
         (SELECT COUNT(*) FROM transactions WHERE category_id = ?) AS transactions,
         (SELECT COUNT(*) FROM budgets WHERE category_id = ?) AS budgets`,
      [id, id],
    );
    return { transactions: row?.transactions ?? 0, budgets: row?.budgets ?? 0 };
  },

  /** Only categories without transactions can be deleted; their budget goes with them. */
  async delete(db: DbClient, id: string): Promise<void> {
    const current = await requireCategory(db, id);
    if (current.isSystem) {
      throw new AppError('VALIDATION', 'The Other category cannot be deleted', {
        detail: 'SYSTEM_CATEGORY',
      });
    }
    const { transactions } = await categoryRepository.usage(db, id);
    if (transactions > 0) {
      throw new AppError('IN_USE', 'Category has transactions', { detail: 'CATEGORY_IN_USE' });
    }
    try {
      await db.run('DELETE FROM categories WHERE id = ?', [id]);
    } catch (error) {
      throw mapSqliteError(error);
    }
  },

  /** First launch only (CAT-01). Returns how many categories were created. */
  async seedDefaultsIfEmpty(db: DbClient, now: Date): Promise<number> {
    const row = await db.get<{ count: number }>('SELECT COUNT(*) AS count FROM categories');
    if ((row?.count ?? 0) > 0) return 0;
    const order: Record<TxnType, number> = { expense: 0, income: 0 };
    for (const category of DEFAULT_CATEGORIES) {
      await categoryRepository.create(db, { ...category, sortOrder: order[category.type]++ }, now);
    }
    return DEFAULT_CATEGORIES.length;
  },
};
