import type { DbClient } from '@/db/client';
import { attachmentRepository } from '@/db/repositories/attachmentRepository';
import { budgetRepository } from '@/db/repositories/budgetRepository';
import { categoryRepository } from '@/db/repositories/categoryRepository';
import {
  markDataChanged,
  SETTING_DEFAULTS,
  settingsRepository,
} from '@/db/repositories/settingsRepository';
import { transactionRepository } from '@/db/repositories/transactionRepository';
import { newId } from '@/lib/ids';
import { createTestDb, TEST_NOW, TEST_TODAY } from '@/test/testDb';

let db: DbClient;
beforeEach(async () => {
  db = await createTestDb();
});

const categoryId = async (name: string, type: 'income' | 'expense') => {
  const found = (await categoryRepository.list(db, { type })).find((c) => c.name === name);
  if (!found) throw new Error(name);
  return found.id;
};

describe('budgets (BUD-01, BUD-02, BUD-04)', () => {
  test('one overall budget: upsert updates instead of adding', async () => {
    const first = await budgetRepository.upsertOverall(db, 1_000_000, TEST_NOW);
    const second = await budgetRepository.upsertOverall(db, 1_200_000, TEST_NOW);
    expect(second.id).toBe(first.id);
    expect(await budgetRepository.list(db)).toEqual([
      expect.objectContaining({ categoryId: null, amountPaise: 1_200_000 }),
    ]);
  });

  test('the DB itself allows only one overall budget', async () => {
    await budgetRepository.upsertOverall(db, 100, TEST_NOW);
    await expect(
      db.run("INSERT INTO budgets VALUES (?, NULL, 100, 'x', 'x')", [newId()]),
    ).rejects.toThrow(/UNIQUE/);
  });

  test('category budgets, overall listed first', async () => {
    const food = await categoryId('Food & Dining', 'expense');
    await budgetRepository.upsertForCategory(db, food, 300_000, TEST_NOW);
    await budgetRepository.upsertOverall(db, 1_000_000, TEST_NOW);
    const list = await budgetRepository.list(db);
    expect(list.map((b) => b.categoryId)).toEqual([null, food]);
  });

  test('FIN-B05 a zero budget is rejected', async () => {
    await expect(budgetRepository.upsertOverall(db, 0, TEST_NOW)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  test('FIN-B08 budget on an income category is rejected (repository and trigger)', async () => {
    const salary = await categoryId('Salary', 'income');
    await expect(
      budgetRepository.upsertForCategory(db, salary, 100, TEST_NOW),
    ).rejects.toMatchObject({ code: 'VALIDATION', detail: 'BUDGET_CATEGORY_NOT_EXPENSE' });
    await expect(
      db.run("INSERT INTO budgets VALUES (?, ?, 100, 'x', 'x')", [newId(), salary]),
    ).rejects.toThrow(/BUDGET_CATEGORY_NOT_EXPENSE/);
  });

  test('budget for a missing category is a clear error', async () => {
    await expect(
      budgetRepository.upsertForCategory(db, 'no-such-category', 100, TEST_NOW),
    ).rejects.toMatchObject({ code: 'VALIDATION', detail: 'CATEGORY_NOT_FOUND' });
  });

  test('delete removes it; deleting again is NOT_FOUND', async () => {
    const b = await budgetRepository.upsertOverall(db, 100, TEST_NOW);
    await budgetRepository.delete(db, b.id);
    expect(await budgetRepository.list(db)).toEqual([]);
    await expect(budgetRepository.delete(db, b.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('attachments (RCP-02)', () => {
  async function newTxn() {
    return transactionRepository.create(
      db,
      {
        type: 'expense',
        amountPaise: 100,
        categoryId: await categoryId('Food & Dining', 'expense'),
        txnDate: TEST_TODAY,
        paymentMethod: 'cash',
      },
      TEST_NOW,
    );
  }
  const attach = (transactionId: string, id = newId()) =>
    attachmentRepository.insert(
      db,
      { id, transactionId, sizeBytes: 2000, width: 800, height: 600 },
      TEST_NOW,
    );

  test('at most 5 per transaction', async () => {
    const t = await newTxn();
    for (let i = 0; i < 5; i++) await attach(t.id);
    await expect(attach(t.id)).rejects.toMatchObject({ detail: 'MAX_ATTACHMENTS' });
    const listed = await attachmentRepository.listByTransaction(db, t.id);
    expect(listed.map((a) => a.sortOrder)).toEqual([0, 1, 2, 3, 4]);
  });

  test('path is derived from the id; non-UUID ids are refused', async () => {
    const t = await newTxn();
    const id = newId();
    expect((await attach(t.id, id)).relativePath).toBe(`receipts/${id}.jpg`);
    await expect(attach(t.id, '../evil')).rejects.toMatchObject({ detail: 'BAD_ID' });
  });

  test('attachment for a missing transaction is refused by the FK', async () => {
    await expect(attach('no-such-transaction')).rejects.toMatchObject({ detail: 'FOREIGN_KEY' });
  });

  test('delete returns the path; reorder sets sort order', async () => {
    const t = await newTxn();
    const a = await attach(t.id);
    const b = await attach(t.id);
    await attachmentRepository.reorder(db, t.id, [b.id, a.id]);
    expect((await attachmentRepository.listByTransaction(db, t.id)).map((x) => x.id)).toEqual([
      b.id,
      a.id,
    ]);
    expect(await attachmentRepository.delete(db, a.id)).toEqual({ relativePath: a.relativePath });
    expect(await attachmentRepository.allRelativePaths(db)).toEqual(new Set([b.relativePath]));
  });
});

describe('settings', () => {
  test('defaults when nothing is stored', async () => {
    expect(await settingsRepository.getAll(db)).toEqual(SETTING_DEFAULTS);
    expect(await settingsRepository.get(db, 'week_start')).toBe('monday');
    expect(await settingsRepository.get(db, 'reminder_time')).toBe('09:00');
  });

  test('set then get', async () => {
    await settingsRepository.set(db, 'theme', 'dark', TEST_NOW);
    await settingsRepository.set(db, 'backup_nudge_dismissed_until', '2026-10-24', TEST_NOW);
    expect(await settingsRepository.get(db, 'theme')).toBe('dark');
    expect(await settingsRepository.get(db, 'backup_nudge_dismissed_until')).toBe('2026-10-24');
  });

  test('invalid values are refused', async () => {
    await expect(
      settingsRepository.set(db, 'reminder_time', '25:00', TEST_NOW),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(
      // @ts-expect-error — wrong type on purpose
      settingsRepository.set(db, 'app_lock_timeout_seconds', 45, TEST_NOW),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  test('a corrupted stored value falls back to the default', async () => {
    await db.run("INSERT INTO app_settings VALUES ('theme', '\"purple\"', 'x')");
    await db.run("INSERT INTO app_settings VALUES ('week_start', 'not json', 'x')");
    expect(await settingsRepository.get(db, 'theme')).toBe('system');
    expect(await settingsRepository.get(db, 'week_start')).toBe('monday');
  });

  test('portable settings exclude device-only keys; replacePortable keeps them', async () => {
    await settingsRepository.set(db, 'app_lock_enabled', true, TEST_NOW);
    await settingsRepository.replacePortable(
      db,
      { theme: 'light', week_start: 'sunday', reminders_enabled: false, reminder_time: '20:30' },
      TEST_NOW,
    );
    expect(await settingsRepository.portableEntries(db)).toEqual({
      theme: 'light',
      week_start: 'sunday',
      reminders_enabled: false,
      reminder_time: '20:30',
    });
    expect(await settingsRepository.get(db, 'app_lock_enabled')).toBe(true);
  });

  test('markDataChanged sets the backup flag inside a transaction', async () => {
    await db.transaction((tx) => markDataChanged(tx, TEST_NOW));
    expect(await settingsRepository.get(db, 'data_changed_since_backup')).toBe(true);
  });
});
