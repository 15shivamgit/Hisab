import type { DbClient } from '@/db/client';
import { attachmentRepository } from '@/db/repositories/attachmentRepository';
import { categoryRepository } from '@/db/repositories/categoryRepository';
import {
  transactionRepository,
  type NewTransaction,
} from '@/db/repositories/transactionRepository';
import type { Category, TxnType } from '@/db/types';
import { monthRange } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { createTestDb, TEST_NOW, TEST_TODAY } from '@/test/testDb';

let db: DbClient;
let cats: Record<string, Category>;

beforeEach(async () => {
  db = await createTestDb();
  const all = await categoryRepository.list(db, { includeArchived: true });
  cats = Object.fromEntries(all.map((c) => [`${c.type}:${c.name}`, c]));
});

const cat = (name: string, type: TxnType = 'expense') => {
  const found = cats[`${type}:${name}`];
  if (!found) throw new Error(`missing ${type}:${name}`);
  return found.id;
};

function add(partial: Partial<NewTransaction> & { amountPaise: number }) {
  const type = partial.type ?? 'expense';
  return transactionRepository.create(
    db,
    {
      type,
      categoryId: partial.categoryId ?? cat(type === 'expense' ? 'Food & Dining' : 'Salary', type),
      txnDate: TEST_TODAY,
      paymentMethod: 'upi',
      ...partial,
    },
    TEST_NOW,
  );
}

const OCT = monthRange(TEST_TODAY);

describe('create / update / delete (TXN-01…03)', () => {
  test('creates with trimmed text; empty text becomes null', async () => {
    const t = await add({ amountPaise: 45000, description: '  Lunch  ', notes: '   ' });
    expect(t).toMatchObject({
      type: 'expense',
      amountPaise: 45000,
      txnDate: TEST_TODAY,
      description: 'Lunch',
      notes: null,
      createdAt: TEST_NOW.toISOString(),
    });
  });

  test.each([
    [{ amountPaise: 0 }, 'AMOUNT_RANGE'],
    [{ amountPaise: 1.5 }, 'AMOUNT_RANGE'],
    [{ amountPaise: 100, txnDate: '2026-02-30' }, 'INVALID_DATE'],
    [{ amountPaise: 100, description: 'x'.repeat(101) }, 'DESCRIPTION_LENGTH'],
    [{ amountPaise: 100, notes: 'x'.repeat(1001) }, 'NOTES_LENGTH'],
    [{ amountPaise: 100, categoryId: 'no-such-category' }, 'CATEGORY_NOT_FOUND'],
  ])('rejects %p with %s', async (partial, detail) => {
    await expect(add(partial)).rejects.toMatchObject({ code: 'VALIDATION', detail });
  });

  test('FIN-T07 expense with an income category is rejected (repository and raw SQL)', async () => {
    await expect(
      add({ amountPaise: 100, categoryId: cat('Salary', 'income') }),
    ).rejects.toMatchObject({ code: 'VALIDATION', detail: 'CATEGORY_TYPE_MISMATCH' });
    await expect(
      db.run(
        `INSERT INTO transactions (id, type, amount_paise, category_id, txn_date, payment_method, created_at, updated_at)
         VALUES (?, 'expense', 100, ?, ?, 'cash', 'x', 'x')`,
        [newId(), cat('Salary', 'income'), TEST_TODAY],
      ),
    ).rejects.toThrow(/CATEGORY_TYPE_MISMATCH/);
  });

  test('update changes fields and keeps createdAt', async () => {
    const t = await add({ amountPaise: 45000 });
    const later = new Date(TEST_NOW.getTime() + 60_000);
    const updated = await transactionRepository.update(
      db,
      t.id,
      { amountPaise: 50000, paymentMethod: 'cash' },
      later,
    );
    expect(updated).toMatchObject({
      amountPaise: 50000,
      paymentMethod: 'cash',
      createdAt: t.createdAt,
      updatedAt: later.toISOString(),
    });
  });

  test('update to a mismatched category is rejected by the update trigger', async () => {
    const t = await add({ amountPaise: 100 });
    await expect(
      transactionRepository.update(db, t.id, { categoryId: cat('Salary', 'income') }, TEST_NOW),
    ).rejects.toMatchObject({ detail: 'CATEGORY_TYPE_MISMATCH' });
  });

  test('delete returns receipt paths and removes their rows (cascade)', async () => {
    const t = await add({ amountPaise: 100 });
    const ids = [newId(), newId()];
    for (const id of ids) {
      await attachmentRepository.insert(
        db,
        { id, transactionId: t.id, sizeBytes: 1000, width: 10, height: 10 },
        TEST_NOW,
      );
    }
    const result = await transactionRepository.delete(db, t.id);
    expect(result.attachmentPaths).toEqual(ids.map((id) => `receipts/${id}.jpg`));
    expect(await attachmentRepository.allRelativePaths(db)).toEqual(new Set());
    await expect(transactionRepository.delete(db, t.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  test('getById includes category and attachments', async () => {
    const t = await add({ amountPaise: 100 });
    const detail = await transactionRepository.getById(db, t.id);
    expect(detail).toMatchObject({
      categoryName: 'Food & Dining',
      categoryIcon: 'restaurant',
      attachmentCount: 0,
      attachments: [],
    });
    expect(await transactionRepository.getById(db, 'missing')).toBeNull();
  });
});

describe('totals (FIN-T)', () => {
  test('FIN-T01 income, expense, net', async () => {
    await add({ type: 'income', amountPaise: 5_000_000, txnDate: '2026-10-01' });
    await add({ amountPaise: 1_200_000, txnDate: '2026-10-05' });
    await add({ amountPaise: 300_000, txnDate: '2026-10-21' });
    const totals = await transactionRepository.sumByType(db, OCT, TEST_TODAY);
    expect(totals).toEqual({ incomePaise: 5_000_000, expensePaise: 1_500_000 });
    expect(totals.incomePaise - totals.expensePaise).toBe(3_500_000);
  });

  test('FIN-T02 net can be negative', async () => {
    await add({ amountPaise: 200_000 });
    const totals = await transactionRepository.sumByType(db, OCT, TEST_TODAY);
    expect(totals.incomePaise - totals.expensePaise).toBe(-200_000);
  });

  test('FIN-T03 future-dated expense is listed but not counted', async () => {
    const future = await add({ amountPaise: 500_000, txnDate: '2026-10-25' });
    expect(await transactionRepository.sumByType(db, OCT, TEST_TODAY)).toEqual({
      incomePaise: 0,
      expensePaise: 0,
    });
    expect(await transactionRepository.upcomingInRange(db, OCT, TEST_TODAY)).toEqual({
      incomePaise: 0,
      expensePaise: 500_000,
      count: 1,
    });
    const listed = await transactionRepository.list(db, {}, { limit: 50, offset: 0 });
    expect(listed.map((t) => t.id)).toContain(future.id);
    expect(await transactionRepository.sumByCategory(db, OCT, 'expense', TEST_TODAY)).toEqual([]);
  });

  test('FIN-T04 counted once its date arrives', async () => {
    await add({ amountPaise: 500_000, txnDate: '2026-10-25' });
    expect(await transactionRepository.sumByType(db, OCT, '2026-10-25')).toEqual({
      incomePaise: 0,
      expensePaise: 500_000,
    });
  });

  test('FIN-T05 month boundaries', async () => {
    await add({ amountPaise: 100, txnDate: '2026-10-31' });
    await add({ amountPaise: 200, txnDate: '2026-11-01' });
    const today = '2026-11-15';
    expect((await transactionRepository.sumByType(db, OCT, today)).expensePaise).toBe(100);
    expect(
      (await transactionRepository.sumByType(db, monthRange('2026-11-01'), today)).expensePaise,
    ).toBe(200);
  });

  test('FIN-T06 empty month gives zeros, not null', async () => {
    expect(await transactionRepository.sumByType(db, OCT, TEST_TODAY)).toEqual({
      incomePaise: 0,
      expensePaise: 0,
    });
    expect(await transactionRepository.upcomingInRange(db, OCT, TEST_TODAY)).toEqual({
      incomePaise: 0,
      expensePaise: 0,
      count: 0,
    });
  });

  test('a fully future range totals zero', async () => {
    await add({ amountPaise: 100, txnDate: '2026-11-05' });
    expect(await transactionRepository.sumByType(db, monthRange('2026-11-05'), TEST_TODAY)).toEqual(
      { incomePaise: 0, expensePaise: 0 },
    );
  });

  test('sumByCategory is sorted by total and excludes the other type', async () => {
    await add({ amountPaise: 100, categoryId: cat('Groceries') });
    await add({ amountPaise: 900, categoryId: cat('Rent') });
    await add({ amountPaise: 200, categoryId: cat('Groceries') });
    await add({ type: 'income', amountPaise: 5000 });
    const rows = await transactionRepository.sumByCategory(db, OCT, 'expense', TEST_TODAY);
    expect(rows.map((r) => [r.categoryName, r.totalPaise, r.count])).toEqual([
      ['Rent', 900, 1],
      ['Groceries', 300, 2],
    ]);
  });

  test('dailyTotals groups by day and stops at today', async () => {
    await add({ amountPaise: 100, txnDate: '2026-10-02' });
    await add({ type: 'income', amountPaise: 500, txnDate: '2026-10-02' });
    await add({ amountPaise: 300, txnDate: '2026-10-21' });
    await add({ amountPaise: 999, txnDate: '2026-10-22' });
    expect(await transactionRepository.dailyTotals(db, OCT, TEST_TODAY)).toEqual([
      { date: '2026-10-02', incomePaise: 500, expensePaise: 100 },
      { date: '2026-10-21', incomePaise: 0, expensePaise: 300 },
    ]);
  });
});

describe('list: filter, search, sort (TXN-04…07)', () => {
  const page = { limit: 50, offset: 0 };

  beforeEach(async () => {
    await add({
      amountPaise: 45000,
      description: 'Lunch',
      categoryId: cat('Food & Dining'),
      txnDate: '2026-10-20',
    });
    await add({
      amountPaise: 4500,
      notes: 'Tea with Rahul',
      categoryId: cat('Food & Dining'),
      paymentMethod: 'cash',
      txnDate: '2026-10-19',
    });
    await add({
      amountPaise: 1_500_000,
      description: '50% off sale',
      categoryId: cat('Shopping'),
      paymentMethod: 'card',
      txnDate: '2026-10-10',
    });
    await add({
      type: 'income',
      amountPaise: 5_000_000,
      description: 'Salary',
      txnDate: '2026-10-01',
    });
  });

  const list = (filter: Parameters<typeof transactionRepository.list>[1]) =>
    transactionRepository.list(db, filter, page);

  test('newest first by default', async () => {
    expect((await list({})).map((t) => t.txnDate)).toEqual([
      '2026-10-20',
      '2026-10-19',
      '2026-10-10',
      '2026-10-01',
    ]);
  });

  test('filters combine (type + category + payment method + range)', async () => {
    const rows = await list({
      type: 'expense',
      categoryIds: [cat('Food & Dining')],
      paymentMethods: ['cash'],
      range: { start: '2026-10-15', end: '2026-10-31' },
    });
    expect(rows.map((t) => t.amountPaise)).toEqual([4500]);
  });

  test('search matches description or notes, case-insensitive', async () => {
    expect((await list({ search: 'lunch' })).map((t) => t.amountPaise)).toEqual([45000]);
    expect((await list({ search: 'RAHUL' })).map((t) => t.amountPaise)).toEqual([4500]);
  });

  test('FIN-T12 search "450" matches the exact amount, not ₹45', async () => {
    expect((await list({ search: '450' })).map((t) => t.amountPaise)).toEqual([45000]);
  });

  test('search escapes LIKE wildcards', async () => {
    expect((await list({ search: '50%' })).map((t) => t.description)).toEqual(['50% off sale']);
    expect(await list({ search: '%' })).toHaveLength(1);
    expect(await list({ search: '_' })).toHaveLength(0);
  });

  test('sort by amount both ways', async () => {
    expect((await list({ sort: 'amount_desc' }))[0]?.amountPaise).toBe(5_000_000);
    expect((await list({ sort: 'amount_asc' }))[0]?.amountPaise).toBe(4500);
    expect((await list({ sort: 'date_asc' }))[0]?.txnDate).toBe('2026-10-01');
  });

  test('pagination', async () => {
    const first = await transactionRepository.list(db, {}, { limit: 2, offset: 0 });
    const second = await transactionRepository.list(db, {}, { limit: 2, offset: 2 });
    expect([...first, ...second].map((t) => t.txnDate)).toEqual([
      '2026-10-20',
      '2026-10-19',
      '2026-10-10',
      '2026-10-01',
    ]);
  });
});
