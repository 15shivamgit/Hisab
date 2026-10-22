// Transactions (TRANSACTIONS.md, TXN-01…10) and the totals built on them
// (FINANCIAL_RULES.md §3: future-dated entries are never counted).

import type { DbClient, SqlParam } from '@/db/client';
import { mapSqliteError } from '@/db/sqlErrors';
import {
  PAYMENT_METHODS,
  TXN_TYPES,
  type Attachment,
  type DateRange,
  type LocalDate,
  type Page,
  type PaymentMethod,
  type Transaction,
  type TransactionDetail,
  type TransactionListItem,
  type TxnFilter,
  type TxnSort,
  type TxnType,
} from '@/db/types';
import { clampEndToToday, isValidLocalDate, toIsoDateTime } from '@/lib/dates';
import { AppError } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { assertPaise, parseRupeesToPaise, type Paise } from '@/lib/money';

interface TransactionRow {
  id: string;
  type: TxnType;
  amount_paise: number;
  category_id: string;
  txn_date: string;
  payment_method: PaymentMethod;
  description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ListRow extends TransactionRow {
  category_name: string;
  category_icon: string;
  category_color: string;
  attachment_count: number;
}

interface AttachmentRow {
  id: string;
  transaction_id: string;
  relative_path: string;
  mime_type: 'image/jpeg';
  size_bytes: number;
  width: number;
  height: number;
  sort_order: number;
  created_at: string;
}

const toTransaction = (row: TransactionRow): Transaction => ({
  id: row.id,
  type: row.type,
  amountPaise: row.amount_paise,
  categoryId: row.category_id,
  txnDate: row.txn_date,
  paymentMethod: row.payment_method,
  description: row.description,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toListItem = (row: ListRow): TransactionListItem => ({
  ...toTransaction(row),
  categoryName: row.category_name,
  categoryIcon: row.category_icon,
  categoryColor: row.category_color,
  attachmentCount: row.attachment_count,
});

export const toAttachment = (row: AttachmentRow): Attachment => ({
  id: row.id,
  transactionId: row.transaction_id,
  relativePath: row.relative_path,
  mimeType: row.mime_type,
  sizeBytes: row.size_bytes,
  width: row.width,
  height: row.height,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
});

export interface NewTransaction {
  type: TxnType;
  amountPaise: Paise;
  categoryId: string;
  txnDate: LocalDate;
  paymentMethod: PaymentMethod;
  description?: string | null;
  notes?: string | null;
}

export type TransactionPatch = Partial<NewTransaction>;

/** Trims; empty becomes null; enforces the max length. */
function cleanText(value: string | null | undefined, max: number, detail: string): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed.length > max) {
    throw new AppError('VALIDATION', `Text longer than ${max} characters`, { detail });
  }
  return trimmed;
}

function validate(input: NewTransaction): NewTransaction {
  if (!TXN_TYPES.includes(input.type)) {
    throw new AppError('VALIDATION', 'Unknown transaction type', { detail: 'TXN_TYPE' });
  }
  assertPaise(input.amountPaise);
  if (!isValidLocalDate(input.txnDate)) {
    throw new AppError('VALIDATION', 'Invalid date', { detail: 'INVALID_DATE' });
  }
  if (!PAYMENT_METHODS.includes(input.paymentMethod)) {
    throw new AppError('VALIDATION', 'Unknown payment method', { detail: 'PAYMENT_METHOD' });
  }
  return {
    ...input,
    description: cleanText(input.description, 100, 'DESCRIPTION_LENGTH'),
    notes: cleanText(input.notes, 1000, 'NOTES_LENGTH'),
  };
}

/**
 * Clear errors for a missing or wrong-type category. (The type trigger would also fire,
 * but it runs before the FK check, so a missing category would look like a type mismatch.)
 */
async function assertCategoryFor(db: DbClient, categoryId: string, type: TxnType): Promise<void> {
  const row = await db.get<{ type: TxnType }>('SELECT type FROM categories WHERE id = ?', [
    categoryId,
  ]);
  if (!row) {
    throw new AppError('VALIDATION', 'Category does not exist', { detail: 'CATEGORY_NOT_FOUND' });
  }
  if (row.type !== type) {
    throw new AppError('VALIDATION', 'Category type does not match transaction type', {
      detail: 'CATEGORY_TYPE_MISMATCH',
    });
  }
}

function mapWriteError(error: unknown): unknown {
  const mapped = mapSqliteError(error);
  if (mapped instanceof AppError && mapped.detail === 'FOREIGN_KEY') {
    return new AppError('VALIDATION', 'Category does not exist', {
      detail: 'CATEGORY_NOT_FOUND',
      cause: error,
    });
  }
  return mapped;
}

/** Escapes LIKE wildcards in user input (used with ESCAPE '\'). */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// ORDER BY comes from this allowlist only — never from user text.
const SORT_SQL: Record<TxnSort, string> = {
  date_desc: 't.txn_date DESC, t.created_at DESC, t.id',
  date_asc: 't.txn_date ASC, t.created_at ASC, t.id',
  amount_desc: 't.amount_paise DESC, t.txn_date DESC, t.id',
  amount_asc: 't.amount_paise ASC, t.txn_date DESC, t.id',
};

function buildWhere(filter: TxnFilter): { sql: string; params: SqlParam[] } {
  const where: string[] = [];
  const params: SqlParam[] = [];
  if (filter.type) {
    where.push('t.type = ?');
    params.push(filter.type);
  }
  if (filter.categoryIds?.length) {
    where.push(`t.category_id IN (${filter.categoryIds.map(() => '?').join(', ')})`);
    params.push(...filter.categoryIds);
  }
  if (filter.paymentMethods?.length) {
    where.push(`t.payment_method IN (${filter.paymentMethods.map(() => '?').join(', ')})`);
    params.push(...filter.paymentMethods);
  }
  if (filter.range) {
    where.push('t.txn_date BETWEEN ? AND ?');
    params.push(filter.range.start, filter.range.end);
  }
  const search = filter.search?.trim();
  if (search) {
    const pattern = likePattern(search);
    const amount = parseRupeesToPaise(search);
    if (amount.ok) {
      where.push(
        "(t.description LIKE ? ESCAPE '\\' OR t.notes LIKE ? ESCAPE '\\' OR t.amount_paise = ?)",
      );
      params.push(pattern, pattern, amount.value);
    } else {
      where.push("(t.description LIKE ? ESCAPE '\\' OR t.notes LIKE ? ESCAPE '\\')");
      params.push(pattern, pattern);
    }
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

const LIST_SELECT = `
  SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
         (SELECT COUNT(*) FROM transaction_attachments a WHERE a.transaction_id = t.id) AS attachment_count
  FROM transactions t
  JOIN categories c ON c.id = t.category_id`;

async function requireTransaction(db: DbClient, id: string): Promise<Transaction> {
  const row = await db.get<TransactionRow>('SELECT * FROM transactions WHERE id = ?', [id]);
  if (!row) throw new AppError('NOT_FOUND', 'Transaction not found', { detail: 'TRANSACTION' });
  return toTransaction(row);
}

export const transactionRepository = {
  async list(db: DbClient, filter: TxnFilter, page: Page): Promise<TransactionListItem[]> {
    const { sql, params } = buildWhere(filter);
    const rows = await db.all<ListRow>(
      `${LIST_SELECT} ${sql} ORDER BY ${SORT_SQL[filter.sort ?? 'date_desc']} LIMIT ? OFFSET ?`,
      [...params, page.limit, page.offset],
    );
    return rows.map(toListItem);
  },

  async getById(db: DbClient, id: string): Promise<TransactionDetail | null> {
    const row = await db.get<ListRow>(`${LIST_SELECT} WHERE t.id = ?`, [id]);
    if (!row) return null;
    const attachments = await db.all<AttachmentRow>(
      'SELECT * FROM transaction_attachments WHERE transaction_id = ? ORDER BY sort_order, created_at',
      [id],
    );
    return { ...toListItem(row), attachments: attachments.map(toAttachment) };
  },

  async create(db: DbClient, input: NewTransaction, now: Date): Promise<Transaction> {
    const t = validate(input);
    await assertCategoryFor(db, t.categoryId, t.type);
    const id = newId();
    const ts = toIsoDateTime(now);
    try {
      await db.run(
        `INSERT INTO transactions (id, type, amount_paise, category_id, txn_date, payment_method, description, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          t.type,
          t.amountPaise,
          t.categoryId,
          t.txnDate,
          t.paymentMethod,
          t.description ?? null,
          t.notes ?? null,
          ts,
          ts,
        ],
      );
    } catch (error) {
      throw mapWriteError(error);
    }
    return requireTransaction(db, id);
  },

  async update(db: DbClient, id: string, patch: TransactionPatch, now: Date): Promise<Transaction> {
    const current = await requireTransaction(db, id);
    const t = validate({ ...current, ...patch });
    await assertCategoryFor(db, t.categoryId, t.type);
    try {
      await db.run(
        `UPDATE transactions SET type = ?, amount_paise = ?, category_id = ?, txn_date = ?,
           payment_method = ?, description = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
        [
          t.type,
          t.amountPaise,
          t.categoryId,
          t.txnDate,
          t.paymentMethod,
          t.description ?? null,
          t.notes ?? null,
          toIsoDateTime(now),
          id,
        ],
      );
    } catch (error) {
      throw mapWriteError(error);
    }
    return requireTransaction(db, id);
  },

  /** Returns the receipt paths so the service can delete the files after commit. */
  async delete(db: DbClient, id: string): Promise<{ attachmentPaths: string[] }> {
    await requireTransaction(db, id);
    const rows = await db.all<{ relative_path: string }>(
      'SELECT relative_path FROM transaction_attachments WHERE transaction_id = ? ORDER BY sort_order',
      [id],
    );
    await db.run('DELETE FROM transactions WHERE id = ?', [id]);
    return { attachmentPaths: rows.map((row) => row.relative_path) };
  },

  /** Income and expense in the range, counting only dates up to today (FR-3.1). */
  async sumByType(
    db: DbClient,
    range: DateRange,
    today: LocalDate,
  ): Promise<{ incomePaise: Paise; expensePaise: Paise }> {
    const effective = clampEndToToday(range, today);
    if (!effective) return { incomePaise: 0, expensePaise: 0 };
    const row = await db.get<{ income: number; expense: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount_paise END), 0) AS income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_paise END), 0) AS expense
       FROM transactions WHERE txn_date BETWEEN ? AND ?`,
      [effective.start, effective.end],
    );
    return { incomePaise: row?.income ?? 0, expensePaise: row?.expense ?? 0 };
  },

  async sumByCategory(
    db: DbClient,
    range: DateRange,
    type: TxnType,
    today: LocalDate,
  ): Promise<
    {
      categoryId: string;
      categoryName: string;
      categoryIcon: string;
      categoryColor: string;
      totalPaise: Paise;
      count: number;
    }[]
  > {
    const effective = clampEndToToday(range, today);
    if (!effective) return [];
    const rows = await db.all<{
      category_id: string;
      name: string;
      icon: string;
      color: string;
      total: number;
      count: number;
    }>(
      `SELECT t.category_id, c.name, c.icon, c.color, SUM(t.amount_paise) AS total, COUNT(*) AS count
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.type = ? AND t.txn_date BETWEEN ? AND ?
       GROUP BY t.category_id
       ORDER BY total DESC, c.name COLLATE NOCASE`,
      [type, effective.start, effective.end],
    );
    return rows.map((row) => ({
      categoryId: row.category_id,
      categoryName: row.name,
      categoryIcon: row.icon,
      categoryColor: row.color,
      totalPaise: row.total,
      count: row.count,
    }));
  },

  /** Days that have entries, oldest first (missing days are filled in by the report code). */
  async dailyTotals(
    db: DbClient,
    range: DateRange,
    today: LocalDate,
  ): Promise<{ date: LocalDate; incomePaise: Paise; expensePaise: Paise }[]> {
    const effective = clampEndToToday(range, today);
    if (!effective) return [];
    const rows = await db.all<{ txn_date: string; income: number; expense: number }>(
      `SELECT txn_date,
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount_paise END), 0) AS income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_paise END), 0) AS expense
       FROM transactions WHERE txn_date BETWEEN ? AND ?
       GROUP BY txn_date ORDER BY txn_date`,
      [effective.start, effective.end],
    );
    return rows.map((row) => ({
      date: row.txn_date,
      incomePaise: row.income,
      expensePaise: row.expense,
    }));
  },

  /** Future-dated entries inside the range ("Upcoming in this period", FR-3.2). */
  async upcomingInRange(
    db: DbClient,
    range: DateRange,
    today: LocalDate,
  ): Promise<{ incomePaise: Paise; expensePaise: Paise; count: number }> {
    const row = await db.get<{ income: number; expense: number; count: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount_paise END), 0) AS income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_paise END), 0) AS expense,
         COUNT(*) AS count
       FROM transactions WHERE txn_date BETWEEN ? AND ? AND txn_date > ?`,
      [range.start, range.end, today],
    );
    return {
      incomePaise: row?.income ?? 0,
      expensePaise: row?.expense ?? 0,
      count: row?.count ?? 0,
    };
  },
};
