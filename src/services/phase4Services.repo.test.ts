import * as changes from '@/db/changes';
import type { DbClient } from '@/db/client';
import { budgetRepository } from '@/db/repositories/budgetRepository';
import { categoryRepository } from '@/db/repositories/categoryRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import {
  transactionRepository,
  type NewTransaction,
} from '@/db/repositories/transactionRepository';
import type { TxnType } from '@/db/types';
import { categoryService } from '@/services/categoryService';
import { dashboardService } from '@/services/dashboardService';
import { transactionService } from '@/services/transactionService';
import { createTestDb, fixedClock, TEST_NOW, TEST_TODAY } from '@/test/testDb';

let db: DbClient;
const clock = fixedClock(TEST_NOW);
let notifySpy: jest.SpyInstance;

beforeEach(async () => {
  db = await createTestDb();
  notifySpy = jest.spyOn(changes, 'notifyChanged');
});
afterEach(() => notifySpy.mockRestore());

async function catId(name: string, type: TxnType = 'expense') {
  const c = (await categoryRepository.list(db, { type, includeArchived: true })).find(
    (x) => x.name === name,
  );
  if (!c) throw new Error(name);
  return c.id;
}

async function input(
  partial: Partial<NewTransaction> & { amountPaise: number },
): Promise<NewTransaction> {
  const type = partial.type ?? 'expense';
  return {
    type,
    categoryId: await catId(type === 'expense' ? 'Food & Dining' : 'Salary', type),
    txnDate: TEST_TODAY,
    paymentMethod: 'upi',
    ...partial,
  };
}

const dataChanged = () => settingsRepository.get(db, 'data_changed_since_backup');

describe('transactionService', () => {
  test('create, update, delete each mark data changed and notify', async () => {
    const t = await transactionService.create(db, clock, await input({ amountPaise: 45000 }));
    expect(await dataChanged()).toBe(true);
    expect(notifySpy).toHaveBeenLastCalledWith(
      expect.arrayContaining(['transactions', 'app_settings']),
    );

    await settingsRepository.set(db, 'data_changed_since_backup', false, TEST_NOW);
    await transactionService.update(db, clock, t.id, { amountPaise: 50000 });
    expect(await dataChanged()).toBe(true);

    await settingsRepository.set(db, 'data_changed_since_backup', false, TEST_NOW);
    expect(await transactionService.delete(db, clock, t.id)).toEqual({ attachmentPaths: [] });
    expect(await dataChanged()).toBe(true);
    expect(await transactionRepository.getById(db, t.id)).toBeNull();
  });

  test('a failed create changes nothing and does not notify', async () => {
    await expect(
      transactionService.create(db, clock, await input({ amountPaise: 0 })),
    ).rejects.toThrow();
    expect(await dataChanged()).toBe(false);
    expect(notifySpy).not.toHaveBeenCalled();
  });

  test('TXN-10 duplicate copies fields with today’s date and saves nothing', async () => {
    const original = await transactionService.create(
      db,
      clock,
      await input({
        amountPaise: 1_500_000,
        txnDate: '2026-09-01',
        description: 'Rent',
        paymentMethod: 'bank_transfer',
      }),
    );
    const later = fixedClock(new Date('2026-11-05T10:00:00+05:30'));
    const draft = await transactionService.duplicate(db, later, original.id);
    expect(draft).toMatchObject({
      amountPaise: 1_500_000,
      description: 'Rent',
      paymentMethod: 'bank_transfer',
      txnDate: '2026-11-05',
    });
    expect((await transactionRepository.summary(db, {}, '2026-12-31')).count).toBe(1);
  });
});

describe('categoryService', () => {
  test('create marks data changed; delete also refreshes budgets', async () => {
    const c = await categoryService.create(db, clock, {
      name: 'Pets',
      type: 'expense',
      icon: 'pets',
      color: 'cat.amber',
    });
    expect(await dataChanged()).toBe(true);
    await budgetRepository.upsertForCategory(db, c.id, 100, TEST_NOW);
    await categoryService.delete(db, clock, c.id);
    expect(notifySpy).toHaveBeenLastCalledWith(expect.arrayContaining(['categories', 'budgets']));
  });

  test('move swaps neighbours and stays inside the list', async () => {
    const names = async () =>
      (await categoryRepository.list(db, { type: 'income' })).map((c) => c.name);
    const before = await names();
    await categoryService.move(db, clock, await catId('Pocket Money', 'income'), 'up');
    expect(await names()).toEqual([before[0], before[2], before[1], ...before.slice(3)]);
    await categoryService.move(db, clock, await catId('Salary', 'income'), 'up'); // already first
    expect((await names())[0]).toBe('Salary');
  });
});

describe('repository helpers for the form and list', () => {
  test('recent categories, last payment method, filtered summary', async () => {
    await transactionService.create(
      db,
      clock,
      await input({ amountPaise: 100, categoryId: await catId('Fuel'), paymentMethod: 'cash' }),
    );
    await transactionService.create(
      db,
      fixedClock(new Date(TEST_NOW.getTime() + 1000)),
      await input({
        amountPaise: 200,
        categoryId: await catId('Rent'),
        paymentMethod: 'card',
        txnDate: '2026-10-30',
      }),
    );
    expect(await transactionRepository.recentCategoryIds(db, 'expense')).toEqual([
      await catId('Rent'),
      await catId('Fuel'),
    ]);
    expect(await transactionRepository.lastPaymentMethod(db)).toBe('card');
    // Future-dated row is counted but not totalled.
    expect(await transactionRepository.summary(db, { type: 'expense' }, TEST_TODAY)).toEqual({
      count: 2,
      incomePaise: 0,
      expensePaise: 100,
    });
  });

  test('listWithUsage counts transactions and budgets', async () => {
    await transactionService.create(
      db,
      clock,
      await input({ amountPaise: 100, categoryId: await catId('Fuel') }),
    );
    await budgetRepository.upsertForCategory(db, await catId('Rent'), 100, TEST_NOW);
    const rows = await categoryRepository.listWithUsage(db, 'expense');
    expect(rows.find((c) => c.name === 'Fuel')).toMatchObject({
      transactionCount: 1,
      hasBudget: false,
    });
    expect(rows.find((c) => c.name === 'Rent')).toMatchObject({
      transactionCount: 0,
      hasBudget: true,
    });
  });
});

describe('dashboardService (DASH-01, DASH-02, DASH-03 list)', () => {
  test('first run: welcome state', async () => {
    const s = await dashboardService.getSummary(db, TEST_TODAY);
    expect(s).toMatchObject({
      hasAnyTransactions: false,
      incomePaise: 0,
      expensePaise: 0,
      netPaise: 0,
      recent: [],
    });
  });

  test('month totals, net, top categories, recent without future entries', async () => {
    await transactionService.create(
      db,
      clock,
      await input({ type: 'income', amountPaise: 5_000_000, txnDate: '2026-10-01' }),
    );
    await transactionService.create(
      db,
      clock,
      await input({ amountPaise: 300_000, categoryId: await catId('Rent') }),
    );
    await transactionService.create(
      db,
      clock,
      await input({ amountPaise: 100_000, categoryId: await catId('Groceries') }),
    );
    await transactionService.create(
      db,
      clock,
      await input({ amountPaise: 900_000, txnDate: '2026-10-25' }),
    );
    await transactionService.create(
      db,
      clock,
      await input({ amountPaise: 777, txnDate: '2026-09-30' }),
    );

    const s = await dashboardService.getSummary(db, TEST_TODAY);
    expect(s).toMatchObject({
      month: { start: '2026-10-01', end: '2026-10-31' },
      incomePaise: 5_000_000,
      expensePaise: 400_000,
      netPaise: 4_600_000,
      hasAnyTransactions: true,
    });
    expect(s.topCategories.map((c) => [c.categoryName, c.percent])).toEqual([
      ['Rent', 75],
      ['Groceries', 25],
    ]);
    expect(s.recent.map((t) => t.txnDate)).not.toContain('2026-10-25');
    expect(s.recent).toHaveLength(4);
  });
});
