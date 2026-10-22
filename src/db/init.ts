// Startup steps 2–4 (ARCHITECTURE.md § Startup sequence): connection PRAGMAs,
// migrations, and the one-time category seed. Works with either driver.

import type { DbClient } from '@/db/client';
import { migrations as appMigrations } from '@/db/migrations';
import { migrate } from '@/db/migrations/runner';
import type { Migration } from '@/db/migrations/types';
import { categoryRepository } from '@/db/repositories/categoryRepository';

export async function initDatabase(
  db: DbClient,
  now: Date,
  migrations: readonly Migration[] = appMigrations,
): Promise<{ schemaVersion: number; seeded: number }> {
  // Per connection, and must run outside a transaction.
  await db.exec('PRAGMA foreign_keys = ON');
  await db.exec('PRAGMA journal_mode = WAL');

  const { to } = await migrate(db, migrations, now);
  const seeded = await db.transaction((tx) => categoryRepository.seedDefaultsIfEmpty(tx, now));
  return { schemaVersion: to, seeded };
}
