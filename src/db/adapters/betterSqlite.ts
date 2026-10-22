// Tests only (Node). Never imported by app code, so it is not bundled.
import Database from 'better-sqlite3';

import { createDbClient, type DbClient } from '@/db/client';

export function openBetterSqliteDatabase(filename = ':memory:'): DbClient {
  const db = new Database(filename);
  return createDbClient({
    run: async (sql, params) => ({ changes: db.prepare(sql).run(...params).changes }),
    get: async <T>(sql: string, params: readonly (string | number | null)[]) =>
      (db.prepare(sql).get(...params) as T | undefined) ?? null,
    all: async <T>(sql: string, params: readonly (string | number | null)[]) =>
      db.prepare(sql).all(...params) as T[],
    exec: async (sql) => {
      db.exec(sql);
    },
  });
}
