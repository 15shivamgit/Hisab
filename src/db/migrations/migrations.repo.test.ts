import { openBetterSqliteDatabase } from '@/db/adapters/betterSqlite';
import { initDatabase } from '@/db/init';
import { LATEST_SCHEMA_VERSION, migrations } from '@/db/migrations';
import { migration0001 } from '@/db/migrations/0001_initial';
import { currentSchemaVersion, migrate } from '@/db/migrations/runner';
import type { Migration } from '@/db/migrations/types';
import { TEST_NOW } from '@/test/testDb';

async function tableNames(db: ReturnType<typeof openBetterSqliteDatabase>) {
  const rows = await db.all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return rows.map((r) => r.name);
}

test('empty database migrates to the latest version', async () => {
  const db = openBetterSqliteDatabase();
  const result = await migrate(db, migrations, TEST_NOW);
  expect(result).toEqual({ from: 0, to: LATEST_SCHEMA_VERSION });
  expect(await tableNames(db)).toEqual([
    'app_settings',
    'budgets',
    'categories',
    'people',
    'schema_migrations',
    'transaction_attachments',
    'transactions',
    'udhaar_entries',
  ]);
  const row = await db.get<{ name: string; applied_at: string }>(
    'SELECT name, applied_at FROM schema_migrations WHERE version = 1',
  );
  expect(row).toEqual({ name: 'initial', applied_at: TEST_NOW.toISOString() });
});

test('running migrations again changes nothing (idempotent)', async () => {
  const db = openBetterSqliteDatabase();
  await migrate(db, migrations, TEST_NOW);
  const second = await migrate(db, migrations, TEST_NOW);
  expect(second).toEqual({ from: LATEST_SCHEMA_VERSION, to: LATEST_SCHEMA_VERSION });
  const count = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM schema_migrations');
  expect(count?.n).toBe(migrations.length);
});

test('database newer than the app is refused without touching data', async () => {
  const db = openBetterSqliteDatabase();
  await migrate(db, migrations, TEST_NOW);
  await db.run("INSERT INTO schema_migrations VALUES (99, 'future', '2030-01-01T00:00:00.000Z')");
  await expect(migrate(db, migrations, TEST_NOW)).rejects.toMatchObject({ code: 'DB_NEWER' });
  expect(await currentSchemaVersion(db)).toBe(99);
});

test('a failing migration is rolled back completely', async () => {
  const db = openBetterSqliteDatabase();
  await migrate(db, migrations, TEST_NOW);
  const broken: Migration = {
    version: migrations.length + 1,
    name: 'broken',
    statements: ['CREATE TABLE half_done (id TEXT)', 'THIS IS NOT SQL'],
  };
  await expect(migrate(db, [...migrations, broken], TEST_NOW)).rejects.toThrow();
  expect(await currentSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
  expect(await tableNames(db)).not.toContain('half_done');
});

test('migrations must be numbered 1, 2, 3', async () => {
  const db = openBetterSqliteDatabase();
  const gap: Migration = { version: migrations.length + 2, name: 'gap', statements: [] };
  await expect(migrate(db, [...migrations, gap], TEST_NOW)).rejects.toMatchObject({
    detail: 'MIGRATION_ORDER',
  });
});

test('existing data survives a later migration', async () => {
  const db = openBetterSqliteDatabase();
  await initDatabase(db, TEST_NOW);
  const before = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
  const next: Migration = {
    version: migrations.length + 1,
    name: 'add_table',
    statements: ['CREATE TABLE extra (id TEXT PRIMARY KEY)'],
  };
  await migrate(db, [...migrations, next], TEST_NOW);
  const after = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
  expect(after?.n).toBe(before?.n);
});

test('initDatabase turns on foreign keys and seeds once', async () => {
  const db = openBetterSqliteDatabase();
  const first = await initDatabase(db, TEST_NOW);
  const second = await initDatabase(db, TEST_NOW);
  expect(first.seeded).toBe(21);
  expect(second.seeded).toBe(0);
  expect((await db.get<{ foreign_keys: number }>('PRAGMA foreign_keys'))?.foreign_keys).toBe(1);
});

test('migration 2: a schema-1 database with data upgrades and keeps everything', async () => {
  const db = openBetterSqliteDatabase();
  await initDatabase(db, TEST_NOW, [migration0001]);
  const food = await db.get<{ id: string }>(
    "SELECT id FROM categories WHERE name = 'Food & Dining'",
  );
  await db.run(
    `INSERT INTO transactions (id, type, amount_paise, category_id, txn_date, payment_method, created_at, updated_at)
     VALUES ('11111111-1111-4111-8111-111111111111', 'expense', 45000, ?, '2026-10-21', 'upi', 'x', 'x')`,
    [food!.id],
  );
  expect(await currentSchemaVersion(db)).toBe(1);

  await initDatabase(db, TEST_NOW);
  expect(await currentSchemaVersion(db)).toBe(2);
  expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM transactions'))?.n).toBe(1);
  expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM categories'))?.n).toBe(21);
  await db.run(
    "INSERT INTO people (id, name, created_at, updated_at) VALUES ('22222222-2222-4222-8222-222222222222', 'Rahul', 'x', 'x')",
  );
  await expect(
    db.run(
      "INSERT INTO udhaar_entries (id, person_id, direction, amount_paise, entry_date, payment_method, created_at, updated_at) VALUES ('33333333-3333-4333-8333-333333333333', 'missing', 'gave', 100, '2026-10-21', 'cash', 'x', 'x')",
    ),
  ).rejects.toThrow(/FOREIGN KEY/);
  expect(await db.all('PRAGMA foreign_key_check')).toEqual([]);
});
