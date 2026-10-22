import { openBetterSqliteDatabase } from '@/db/adapters/betterSqlite';
import type { DbClient } from '@/db/client';
import { initDatabase } from '@/db/init';
import type { Clock } from '@/lib/clock';

/** 2026-10-21 10:00 IST — "today" in FINANCIAL_TEST_CASES.md. */
export const TEST_NOW = new Date('2026-10-21T10:00:00+05:30');
export const TEST_TODAY = '2026-10-21';

export function fixedClock(iso: string | Date): Clock {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return { now: () => new Date(date.getTime()) };
}

/** Fresh in-memory SQLite with all migrations applied and default categories seeded. */
export async function createTestDb(now: Date = TEST_NOW): Promise<DbClient> {
  const db = openBetterSqliteDatabase();
  await initDatabase(db, now);
  return db;
}
