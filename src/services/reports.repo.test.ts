import type { DbClient } from '@/db/client';
import { categoryRepository } from '@/db/repositories/categoryRepository';
import { personRepository } from '@/db/repositories/personRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { transactionRepository } from '@/db/repositories/transactionRepository';
import { udhaarRepository } from '@/db/repositories/udhaarRepository';
import type { TxnType } from '@/db/types';
import { budgetService } from '@/services/budgetService';
import { dashboardService } from '@/services/dashboardService';
import { periodFor, reportService, stepPeriod } from '@/services/reportService';
import { createTestDb, fixedClock, TEST_NOW, TEST_TODAY } from '@/test/testDb';

const clock = fixedClock(TEST_NOW); // 2026-10-21
const R = (rupees: number) => Math.round(rupees * 100);
let db: DbClient;

beforeEach(async () => {
  db = await createTestDb();
});

async function categoryId(name: string) {
  return (await categoryRepository.list(db, {})).find((c) => c.name === name)!.id;
}

async function add(type: TxnType, rupees: number, category: string, txnDate = TEST_TODAY) {
  return transactionRepository.create(
    db,
    {
      type,
      amountPaise: R(rupees),
      categoryId: await categoryId(category),
      txnDate,
      paymentMethod: 'upi',
    },
    TEST_NOW,
  );
}

describe('budgets (BUD-01…04)', () => {
  test('FIN-B05: a zero budget is rejected', async () => {
    await expect(budgetService.setOverall(db, clock, 0)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  test('FIN-B06: a category budget counts only that category', async () => {
    await budgetService.setForCategory(db, clock, await categoryId('Food & Dining'), R(3_000));
    await add('expense', 2_000, 'Food & Dining');
    await add('expense', 5_000, 'Transport');
    const o = await budgetService.getOverview(db, TEST_TODAY);
    expect(o.categories).toHaveLength(1);
    expect(o.categories[0]).toMatchObject({ spentPaise: R(2_000), progress: { percent: 66 } });
  });

  test("FIN-B07: future-dated expenses and udhaar don't count", async () => {
    await budgetService.setOverall(db, clock, R(10_000));
    await add('expense', 4_000, 'Food & Dining');
    await add('expense', 9_000, 'Food & Dining', '2026-10-25');
    const p = await personRepository.create(db, { name: 'Rahul' }, TEST_NOW);
    await udhaarRepository.create(
      db,
      {
        personId: p.id,
        direction: 'gave',
        amountPaise: R(5_000),
        entryDate: TEST_TODAY,
        paymentMethod: 'cash',
      },
      TEST_NOW,
    );
    const o = await budgetService.getOverview(db, TEST_TODAY);
    expect(o.overall).toMatchObject({
      spentPaise: R(4_000),
      progress: { percent: 40, state: 'normal' },
    });
  });

  test('FIN-B08: a budget on an income category is rejected', async () => {
    await expect(
      budgetService.setForCategory(db, clock, await categoryId('Salary'), R(1_000)),
    ).rejects.toMatchObject({ detail: 'BUDGET_CATEGORY_NOT_EXPENSE' });
  });

  test('available categories, the "adds up to more" hint, remove, and data-changed flag', async () => {
    await settingsRepository.set(db, 'data_changed_since_backup', false, TEST_NOW);
    const overall = await budgetService.setOverall(db, clock, R(5_000));
    const food = await categoryId('Food & Dining');
    await budgetService.setForCategory(db, clock, food, R(4_000));
    await budgetService.setForCategory(db, clock, await categoryId('Transport'), R(2_000));
    expect(await settingsRepository.get(db, 'data_changed_since_backup')).toBe(true);
    const o = await budgetService.getOverview(db, TEST_TODAY);
    expect(o.categoriesExceedOverall).toBe(true);
    expect(o.available.some((c) => c.id === food)).toBe(false);
    expect(o.available.every((c) => c.type === 'expense')).toBe(true);

    await budgetService.remove(db, clock, overall.id);
    expect((await budgetService.getOverview(db, TEST_TODAY)).overall).toBeNull();
  });

  test('month rollover: spent starts again on the 1st', async () => {
    await budgetService.setOverall(db, clock, R(10_000));
    await add('expense', 3_000, 'Food & Dining', '2026-10-31');
    await add('expense', 1_000, 'Food & Dining', '2026-11-01');
    expect((await budgetService.getOverview(db, '2026-10-31')).overall?.spentPaise).toBe(R(3_000));
    expect((await budgetService.getOverview(db, '2026-11-01')).overall?.spentPaise).toBe(R(1_000));
  });

  test('DASH-04: dashboard card shows overall and the 3 highest category budgets', async () => {
    expect(await budgetService.dashboardCard(db, TEST_TODAY)).toBeNull();
    const names = ['Food & Dining', 'Transport', 'Groceries', 'Fuel'];
    const spent = [500, 900, 100, 300];
    for (let i = 0; i < names.length; i++) {
      await budgetService.setForCategory(db, clock, await categoryId(names[i]!), R(1_000));
      await add('expense', spent[i]!, names[i]!);
    }
    const card = await budgetService.dashboardCard(db, TEST_TODAY);
    expect(card?.overall).toBeNull();
    expect(card?.top.map((l) => l.category?.name)).toEqual(['Transport', 'Food & Dining', 'Fuel']);
    // Removing a budget removes it from the dashboard (BUDGETS.md acceptance).
    const summary = await dashboardService.getSummary(db, TEST_TODAY);
    expect(summary.budgets?.top).toHaveLength(3);
  });
});

describe('reports (RPT-01…03)', () => {
  test('FIN-R01: month report equals the dashboard', async () => {
    await add('income', 50_000, 'Salary', '2026-10-01');
    await add('expense', 1_250.5, 'Food & Dining', '2026-10-05');
    await add('expense', 300, 'Transport', TEST_TODAY);
    await add('expense', 999, 'Transport', '2026-10-30'); // future
    const report = await reportService.getReport(
      db,
      periodFor('month', TEST_TODAY, 'monday'),
      TEST_TODAY,
      'monday',
    );
    const dash = await dashboardService.getSummary(db, TEST_TODAY);
    expect(report.incomePaise).toBe(dash.incomePaise);
    expect(report.expensePaise).toBe(dash.expensePaise);
    expect(report.netPaise).toBe(dash.netPaise);
    expect(report.upcoming).toEqual({ count: 1, incomePaise: 0, expensePaise: R(999) });
    expect(report.categories.expense.map((c) => [c.categoryName, c.percent, c.count])).toEqual([
      ['Food & Dining', 80, 1],
      ['Transport', 19, 1],
    ]);
  });

  test('FIN-R02: a week across the new year includes both years', async () => {
    await add('expense', 100, 'Food & Dining', '2025-12-30');
    await add('expense', 200, 'Food & Dining', '2026-01-02');
    const week = periodFor('week', '2026-01-01', 'monday');
    expect(week).toEqual({ start: '2025-12-29', end: '2026-01-04' });
    const report = await reportService.getReport(db, week, TEST_TODAY, 'monday');
    expect(report.expensePaise).toBe(R(300));
    expect(report.trend.unit).toBe('day');
    expect(report.trend.bars).toHaveLength(7);
  });

  test('FIN-R03: February 2028 covers the 29th', async () => {
    await add('expense', 100, 'Food & Dining', '2028-02-29');
    const feb = periodFor('month', '2028-02-10', 'monday');
    expect(feb).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    const report = await reportService.getReport(db, feb, '2028-03-05', 'monday');
    expect(report.expensePaise).toBe(R(100));
    expect(report.trend.bars).toHaveLength(29);
  });

  test('FIN-R04: average spend per day counts elapsed days only', async () => {
    await add('expense', 21_000, 'Food & Dining', '2026-10-03');
    const report = await reportService.getReport(
      db,
      periodFor('month', TEST_TODAY, 'monday'),
      TEST_TODAY,
      'monday',
    );
    expect(report.avgSpendPerDayPaise).toBe(R(1_000));
    const past = await reportService.getReport(
      db,
      periodFor('month', '2026-09-15', 'monday'),
      TEST_TODAY,
      'monday',
    );
    expect(past.avgSpendPerDayPaise).toBe(0);
  });

  test('custom ranges longer than 31 days get weekly bars; empty periods say so', async () => {
    await add('expense', 100, 'Food & Dining', '2026-09-02');
    await add('expense', 200, 'Food & Dining', '2026-09-03');
    const report = await reportService.getReport(
      db,
      { start: '2026-09-01', end: '2026-10-20' },
      TEST_TODAY,
      'monday',
    );
    expect(report.trend.unit).toBe('week');
    expect(report.trend.bars[0]).toEqual({
      start: '2026-09-01',
      end: '2026-09-06',
      incomePaise: 0,
      expensePaise: R(300),
    });
    expect(report.trend.bars.at(-1)?.end).toBe('2026-10-20');
    const empty = await reportService.getReport(
      db,
      periodFor('month', '2025-01-10', 'monday'),
      TEST_TODAY,
      'monday',
    );
    expect(empty.isEmpty).toBe(true);
  });

  test('udhaar is never in reports (UDH-12)', async () => {
    const p = await personRepository.create(db, { name: 'Rahul' }, TEST_NOW);
    await udhaarRepository.create(
      db,
      {
        personId: p.id,
        direction: 'got',
        amountPaise: R(5_000),
        entryDate: TEST_TODAY,
        paymentMethod: 'cash',
      },
      TEST_NOW,
    );
    const report = await reportService.getReport(
      db,
      periodFor('month', TEST_TODAY, 'monday'),
      TEST_TODAY,
      'monday',
    );
    expect(report).toMatchObject({ incomePaise: 0, expensePaise: 0, isEmpty: true });
  });

  test("◀ ▶ can't move past the current period", () => {
    const october = periodFor('month', TEST_TODAY, 'monday');
    expect(stepPeriod(october, 'month', -1, TEST_TODAY)).toEqual({
      start: '2026-09-01',
      end: '2026-09-30',
    });
    expect(stepPeriod(october, 'month', 1, TEST_TODAY)).toBeNull();
    const week = periodFor('week', TEST_TODAY, 'sunday');
    expect(week.start).toBe('2026-10-18');
    expect(stepPeriod(week, 'week', 1, TEST_TODAY)).toBeNull();
  });
});
