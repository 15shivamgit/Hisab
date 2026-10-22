import type { DbClient } from '@/db/client';
import { budgetRepository } from '@/db/repositories/budgetRepository';
import { categoryRepository } from '@/db/repositories/categoryRepository';
import { transactionRepository } from '@/db/repositories/transactionRepository';
import { DEFAULT_CATEGORIES } from '@/db/seed/defaultCategories';
import { createTestDb, TEST_NOW, TEST_TODAY } from '@/test/testDb';

let db: DbClient;
beforeEach(async () => {
  db = await createTestDb();
});

const byName = async (name: string, type: 'income' | 'expense' = 'expense') => {
  const found = (await categoryRepository.list(db, { type, includeArchived: true })).find(
    (c) => c.name === name,
  );
  if (!found) throw new Error(`missing ${name}`);
  return found;
};

describe('seed (CAT-01)', () => {
  test('creates 15 expense and 6 income categories, Other is system', async () => {
    const expense = await categoryRepository.list(db, { type: 'expense' });
    const income = await categoryRepository.list(db, { type: 'income' });
    expect(expense).toHaveLength(15);
    expect(income).toHaveLength(6);
    expect(expense.map((c) => c.name)[0]).toBe('Food & Dining');
    expect(expense.filter((c) => c.isSystem).map((c) => c.name)).toEqual(['Other']);
    expect(income.filter((c) => c.isSystem).map((c) => c.name)).toEqual(['Other']);
  });

  test('runs once', async () => {
    expect(await categoryRepository.seedDefaultsIfEmpty(db, TEST_NOW)).toBe(0);
    expect(await categoryRepository.list(db, { includeArchived: true })).toHaveLength(21);
  });

  test('every default icon exists in the installed Material Symbols list', () => {
    // Read from disk: the package's "exports" field hides this file from require().
    const fs = jest.requireActual<typeof import('node:fs')>('node:fs');
    const path = jest.requireActual<typeof import('node:path')>('node:path');
    const symbols = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'node_modules/expo-symbols/src/android/symbols.json'),
        'utf8',
      ),
    ) as Record<string, number>;
    const missing = DEFAULT_CATEGORIES.map((c) => c.icon).filter((icon) => !(icon in symbols));
    expect(missing).toEqual([]);
  });
});

describe('create / rename (CAT-02, CAT-03)', () => {
  test('names are unique per type, case-insensitive', async () => {
    await expect(
      categoryRepository.create(
        db,
        { name: 'food & dining', type: 'expense', icon: 'restaurant', color: 'cat.red' },
        TEST_NOW,
      ),
    ).rejects.toMatchObject({ code: 'CONSTRAINT', detail: 'CATEGORY_DUPLICATE' });
  });

  test('the same name is allowed for the other type', async () => {
    const created = await categoryRepository.create(
      db,
      { name: 'Rent', type: 'income', icon: 'home', color: 'cat.green' },
      TEST_NOW,
    );
    expect(created).toMatchObject({ name: 'Rent', type: 'income', isSystem: false });
  });

  test('name is trimmed and must be 1–30 characters', async () => {
    const created = await categoryRepository.create(
      db,
      { name: '  Pets  ', type: 'expense', icon: 'pets', color: 'cat.amber' },
      TEST_NOW,
    );
    expect(created.name).toBe('Pets');
    expect(created.sortOrder).toBe(15);
    await expect(
      categoryRepository.create(
        db,
        { name: '   ', type: 'expense', icon: 'x', color: 'cat.red' },
        TEST_NOW,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(
      categoryRepository.create(
        db,
        { name: 'x'.repeat(31), type: 'expense', icon: 'x', color: 'cat.red' },
        TEST_NOW,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  test('rename, recolour, re-icon', async () => {
    const food = await byName('Food & Dining');
    const updated = await categoryRepository.update(
      db,
      food.id,
      { name: 'Food', color: 'cat.red', icon: 'lunch_dining' },
      TEST_NOW,
    );
    expect(updated).toMatchObject({ name: 'Food', color: 'cat.red', icon: 'lunch_dining' });
  });
});

describe('Other category (CAT-05)', () => {
  test('cannot be deleted, archived, or renamed — but can change colour', async () => {
    const other = await byName('Other');
    await expect(categoryRepository.delete(db, other.id)).rejects.toMatchObject({
      detail: 'SYSTEM_CATEGORY',
    });
    await expect(
      categoryRepository.setArchived(db, other.id, true, TEST_NOW),
    ).rejects.toMatchObject({ detail: 'SYSTEM_CATEGORY' });
    await expect(
      categoryRepository.update(db, other.id, { name: 'Misc' }, TEST_NOW),
    ).rejects.toMatchObject({ detail: 'SYSTEM_CATEGORY' });
    const recoloured = await categoryRepository.update(
      db,
      other.id,
      { color: 'cat.red' },
      TEST_NOW,
    );
    expect(recoloured.color).toBe('cat.red');
  });
});

describe('delete and archive (CAT-04)', () => {
  test('FIN-T09 a category used by a transaction cannot be deleted', async () => {
    const food = await byName('Food & Dining');
    await transactionRepository.create(
      db,
      {
        type: 'expense',
        amountPaise: 45000,
        categoryId: food.id,
        txnDate: TEST_TODAY,
        paymentMethod: 'upi',
      },
      TEST_NOW,
    );
    await expect(categoryRepository.delete(db, food.id)).rejects.toMatchObject({ code: 'IN_USE' });
    // Bypassing the repository, the FK (ON DELETE RESTRICT) still blocks it.
    await expect(db.run('DELETE FROM categories WHERE id = ?', [food.id])).rejects.toThrow(
      /FOREIGN KEY/,
    );
  });

  test('FIN-T10 a category with only a budget can be deleted; the budget goes too', async () => {
    const fuel = await byName('Fuel');
    await budgetRepository.upsertForCategory(db, fuel.id, 300000, TEST_NOW);
    expect(await categoryRepository.usage(db, fuel.id)).toEqual({ transactions: 0, budgets: 1 });
    await categoryRepository.delete(db, fuel.id);
    expect(await categoryRepository.getById(db, fuel.id)).toBeNull();
    expect(await budgetRepository.list(db)).toEqual([]);
  });

  test('archived categories are hidden from the default list and can be unarchived', async () => {
    const travel = await byName('Travel');
    await categoryRepository.setArchived(db, travel.id, true, TEST_NOW);
    const visible = await categoryRepository.list(db, { type: 'expense' });
    expect(visible.map((c) => c.id)).not.toContain(travel.id);
    const restored = await categoryRepository.setArchived(db, travel.id, false, TEST_NOW);
    expect(restored.archivedAt).toBeNull();
  });
});

describe('type changes', () => {
  test('FIN-T11 type cannot change once the category has transactions (trigger)', async () => {
    const health = await byName('Health');
    await transactionRepository.create(
      db,
      {
        type: 'expense',
        amountPaise: 100,
        categoryId: health.id,
        txnDate: TEST_TODAY,
        paymentMethod: 'cash',
      },
      TEST_NOW,
    );
    await expect(
      categoryRepository.update(db, health.id, { type: 'income' }, TEST_NOW),
    ).rejects.toMatchObject({ code: 'IN_USE', detail: 'CATEGORY_IN_USE' });
    await expect(
      db.run("UPDATE categories SET type = 'income' WHERE id = ?", [health.id]),
    ).rejects.toThrow(/CATEGORY_IN_USE/);
  });

  test('FIN-T11 type cannot change once the category has a budget (trigger)', async () => {
    const rent = await byName('Rent');
    await budgetRepository.upsertForCategory(db, rent.id, 100, TEST_NOW);
    await expect(
      db.run("UPDATE categories SET type = 'income' WHERE id = ?", [rent.id]),
    ).rejects.toThrow(/CATEGORY_IN_USE/);
  });

  test('an unused category can change type', async () => {
    const shopping = await byName('Shopping');
    const moved = await categoryRepository.update(db, shopping.id, { type: 'income' }, TEST_NOW);
    expect(moved.type).toBe('income');
  });
});
