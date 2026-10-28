import { migration0001 } from '@/db/migrations/0001_initial';
import { migration0002 } from '@/db/migrations/0002_udhaar';
import type { Migration } from '@/db/migrations/types';

/** Ordered list. Backup `schemaVersion` = the last version here. */
export const migrations: readonly Migration[] = [migration0001, migration0002];

export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1]?.version ?? 0;
