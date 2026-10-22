import { openDatabaseAsync, type SQLiteBindValue } from 'expo-sqlite';

import { createDbClient, type DbClient } from '@/db/client';

export const DATABASE_NAME = 'hisaab.db';

/** Opens the app database on the device. Run `initDatabase` on the result before use. */
export async function openExpoDatabase(name: string = DATABASE_NAME): Promise<DbClient> {
  const db = await openDatabaseAsync(name);
  return createDbClient({
    run: async (sql, params) => {
      const result = await db.runAsync(sql, params as SQLiteBindValue[]);
      return { changes: result.changes };
    },
    get: (sql, params) => db.getFirstAsync(sql, params as SQLiteBindValue[]),
    all: (sql, params) => db.getAllAsync(sql, params as SQLiteBindValue[]),
    exec: (sql) => db.execAsync(sql),
  });
}
