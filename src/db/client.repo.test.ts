import { openBetterSqliteDatabase } from '@/db/adapters/betterSqlite';
import type { DbClient } from '@/db/client';

async function freshTable(): Promise<DbClient> {
  const db = openBetterSqliteDatabase();
  await db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT NOT NULL)');
  return db;
}

const count = async (db: DbClient) =>
  (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM t'))?.n;

test('transaction commits all writes', async () => {
  const db = await freshTable();
  await db.transaction(async (tx) => {
    await tx.run('INSERT INTO t (v) VALUES (?)', ['a']);
    await tx.run('INSERT INTO t (v) VALUES (?)', ['b']);
  });
  expect(await count(db)).toBe(2);
});

test('transaction rolls back everything on error', async () => {
  const db = await freshTable();
  await expect(
    db.transaction(async (tx) => {
      await tx.run('INSERT INTO t (v) VALUES (?)', ['a']);
      throw new Error('boom');
    }),
  ).rejects.toThrow('boom');
  expect(await count(db)).toBe(0);
});

test('nested transaction joins the outer one', async () => {
  const db = await freshTable();
  await expect(
    db.transaction(async (tx) => {
      await tx.transaction(async (inner) => {
        await inner.run('INSERT INTO t (v) VALUES (?)', ['a']);
      });
      throw new Error('outer fails');
    }),
  ).rejects.toThrow();
  expect(await count(db)).toBe(0);
});

test('queries started during a transaction wait for it to finish', async () => {
  const db = await freshTable();
  const seen: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));

  const txDone = db.transaction(async (tx) => {
    await tx.run('INSERT INTO t (v) VALUES (?)', ['in-tx']);
    await gate;
    seen.push('tx-end');
  });
  const read = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM t').then((row) => {
    seen.push(`read:${row?.n}`);
  });

  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(seen).toEqual([]);
  release();
  await Promise.all([txDone, read]);
  expect(seen).toEqual(['tx-end', 'read:1']);
});

test('a failed operation does not block later ones', async () => {
  const db = await freshTable();
  await expect(db.run('INSERT INTO nope VALUES (1)')).rejects.toThrow();
  await db.run('INSERT INTO t (v) VALUES (?)', ['ok']);
  expect(await count(db)).toBe(1);
});

test('get returns null when there is no row', async () => {
  const db = await freshTable();
  expect(await db.get('SELECT * FROM t WHERE id = ?', [99])).toBeNull();
});
