// App start: open the database, apply PRAGMAs and migrations, seed defaults
// (ARCHITECTURE.md § Startup sequence, steps 1–4). Later phases add restore recovery,
// housekeeping, and the lock gate.

import { openExpoDatabase } from '@/db/adapters/expoSqlite';
import type { DbClient } from '@/db/client';
import { initDatabase } from '@/db/init';
import type { Clock } from '@/lib/clock';
import { toAppError } from '@/lib/errors';
import { diagnostics } from '@/services/diagnostics';

export interface StartedDatabase {
  db: DbClient;
  schemaVersion: number;
}

// One connection for the app's lifetime. If opening fails, "Try again" opens anew.
let opened: Promise<DbClient> | null = null;

function openOnce(): Promise<DbClient> {
  opened ??= openExpoDatabase().catch((error: unknown) => {
    opened = null;
    throw error;
  });
  return opened;
}

export async function startDatabase(clock: Clock): Promise<StartedDatabase> {
  try {
    const db = await openOnce();
    const { schemaVersion } = await initDatabase(db, clock.now());
    return { db, schemaVersion };
  } catch (error) {
    const appError = toAppError(error);
    await diagnostics.record(appError, 'startup');
    throw appError;
  }
}
