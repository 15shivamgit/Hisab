// Migration runner. Rules: docs/03-database/MIGRATIONS.md.

import type { DbClient } from '@/db/client';
import type { Migration } from '@/db/migrations/types';
import { toIsoDateTime } from '@/lib/dates';
import { AppError } from '@/lib/errors';

export async function currentSchemaVersion(db: DbClient): Promise<number> {
  const row = await db.get<{ version: number | null }>(
    'SELECT MAX(version) AS version FROM schema_migrations',
  );
  return row?.version ?? 0;
}

function assertConsecutive(migrations: readonly Migration[]): void {
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new AppError('UNKNOWN', 'Migrations must be numbered 1, 2, 3, …', {
        detail: 'MIGRATION_ORDER',
      });
    }
  });
}

/**
 * Applies pending migrations, each in its own transaction together with its
 * schema_migrations row. Refuses to touch a database made by a newer app version.
 */
export async function migrate(
  db: DbClient,
  migrations: readonly Migration[],
  now: Date,
): Promise<{ from: number; to: number }> {
  assertConsecutive(migrations);

  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    applied_at  TEXT    NOT NULL
  )`);

  const from = await currentSchemaVersion(db);
  const latest = migrations.length;
  if (from > latest) {
    throw new AppError('DB_NEWER', 'Database was created by a newer app version', {
      detail: `DB_V${from}_APP_V${latest}`,
    });
  }

  for (const migration of migrations.slice(from)) {
    await db.transaction(async (tx) => {
      for (const statement of migration.statements) await tx.exec(statement);
      await tx.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', [
        migration.version,
        migration.name,
        toIsoDateTime(now),
      ]);
    });
  }

  const violations = await db.all('PRAGMA foreign_key_check');
  if (violations.length > 0) {
    throw new AppError('UNKNOWN', 'Foreign key check failed after migrations', {
      detail: 'FK_CHECK_FAILED',
    });
  }
  return { from, to: latest };
}
