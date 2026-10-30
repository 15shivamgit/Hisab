// Error paths of the budget and udhaar repositories (Phase 10 coverage review).
import type { DbClient } from '@/db/client';
import { budgetRepository } from '@/db/repositories/budgetRepository';
import { categoryRepository } from '@/db/repositories/categoryRepository';
import { personRepository } from '@/db/repositories/personRepository';
import { udhaarRepository } from '@/db/repositories/udhaarRepository';
import type { NewUdhaarEntry } from '@/db/repositories/udhaarRepository';
import { createTestDb, TEST_NOW, TEST_TODAY } from '@/test/testDb';

let db: DbClient;

beforeEach(async () => {
  db = await createTestDb();
});

/** The same client, but every `run` fails with the given SQLite message. */
function failingRuns(message: string): DbClient {
  return {
    ...db,
    run: async () => {
      throw new Error(message);
    },
  };
}

describe('budgetRepository write errors', () => {
  test('a category that vanished before the insert is reported as not found', async () => {
    const food = (await categoryRepository.list(db, {})).find((c) => c.name === 'Food & Dining')!;
    await expect(
      budgetRepository.upsertForCategory(
        failingRuns('FOREIGN KEY constraint failed'),
        food.id,
        100_000,
        TEST_NOW,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION', detail: 'CATEGORY_NOT_FOUND' });
  });

  test('a duplicate budget is reported as BUDGET_DUPLICATE', async () => {
    await expect(
      budgetRepository.upsertOverall(
        failingRuns('UNIQUE constraint failed: budgets.category_id'),
        100_000,
        TEST_NOW,
      ),
    ).rejects.toMatchObject({ code: 'CONSTRAINT', detail: 'BUDGET_DUPLICATE' });
  });
});

describe('udhaarRepository validation', () => {
  let personId: string;
  const entry = (patch: Partial<NewUdhaarEntry> = {}): NewUdhaarEntry => ({
    personId,
    direction: 'gave',
    amountPaise: 50_000,
    entryDate: TEST_TODAY,
    paymentMethod: 'cash',
    ...patch,
  });

  beforeEach(async () => {
    personId = (await personRepository.create(db, { name: 'Rahul' }, TEST_NOW)).id;
  });

  test.each([
    ['unknown direction', { direction: 'lent' as never }, 'DIRECTION'],
    ['invalid date', { entryDate: '2026-02-30' }, 'INVALID_DATE'],
    ['unknown payment method', { paymentMethod: 'cheque' as never }, 'PAYMENT_METHOD'],
    ['note over 500 characters', { note: 'x'.repeat(501) }, 'note.max'],
  ])('%s is rejected and nothing is written', async (_label, patch, detail) => {
    await expect(udhaarRepository.create(db, entry(patch), TEST_NOW)).rejects.toMatchObject({
      code: 'VALIDATION',
      detail,
    });
    expect(await udhaarRepository.listByPerson(db, personId)).toHaveLength(0);
  });

  test('getById returns the entry, or null for an unknown id', async () => {
    const created = await udhaarRepository.create(db, entry(), TEST_NOW);
    expect(await udhaarRepository.getById(db, created.id)).toMatchObject({
      id: created.id,
      amountPaise: 50_000,
    });
    expect(await udhaarRepository.getById(db, 'missing')).toBeNull();
  });

  test('a failing write is mapped (foreign key → CONSTRAINT)', async () => {
    const created = await udhaarRepository.create(db, entry(), TEST_NOW);
    const broken = failingRuns('FOREIGN KEY constraint failed');
    await expect(
      udhaarRepository.update(broken, created.id, { amountPaise: 60_000 }, TEST_NOW),
    ).rejects.toMatchObject({ code: 'CONSTRAINT', detail: 'FOREIGN_KEY' });
  });
});
