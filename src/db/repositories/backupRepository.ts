// Raw table access for backup and restore (REPOSITORIES.md § backupRepository,
// BACKUP_AND_RESTORE.md). Rows keep the DB column names, exactly as in data.json.

import type { DbClient, SqlParam } from '@/db/client';
import { settingsRepository, type PortableSettings } from '@/db/repositories/settingsRepository';

/** Backed-up tables in parent → child order, with their columns (schema v2). */
export const BACKUP_TABLES = {
  categories: [
    'id',
    'name',
    'type',
    'icon',
    'color',
    'is_system',
    'sort_order',
    'archived_at',
    'created_at',
    'updated_at',
  ],
  transactions: [
    'id',
    'type',
    'amount_paise',
    'category_id',
    'txn_date',
    'payment_method',
    'description',
    'notes',
    'created_at',
    'updated_at',
  ],
  transaction_attachments: [
    'id',
    'transaction_id',
    'relative_path',
    'mime_type',
    'size_bytes',
    'width',
    'height',
    'sort_order',
    'created_at',
  ],
  budgets: ['id', 'category_id', 'amount_paise', 'created_at', 'updated_at'],
  people: [
    'id',
    'name',
    'phone',
    'notes',
    'return_by_date',
    'archived_at',
    'created_at',
    'updated_at',
  ],
  udhaar_entries: [
    'id',
    'person_id',
    'direction',
    'amount_paise',
    'entry_date',
    'payment_method',
    'note',
    'created_at',
    'updated_at',
  ],
} as const;

export type BackupTable = keyof typeof BACKUP_TABLES;
export type BackupRow = Record<string, SqlParam>;

export interface BackupTables {
  categories: BackupRow[];
  transactions: BackupRow[];
  transactionAttachments: BackupRow[];
  budgets: BackupRow[];
  people: BackupRow[];
  udhaarEntries: BackupRow[];
}

export interface BackupData extends BackupTables {
  settings: PortableSettings;
}

/** data.json key for each table. */
export const TABLE_KEYS: Record<BackupTable, keyof BackupTables> = {
  categories: 'categories',
  transactions: 'transactions',
  transaction_attachments: 'transactionAttachments',
  budgets: 'budgets',
  people: 'people',
  udhaar_entries: 'udhaarEntries',
};

const PARENT_FIRST = Object.keys(BACKUP_TABLES) as BackupTable[];
const ROWS_PER_INSERT = 50;

async function insertRows(tx: DbClient, table: BackupTable, rows: readonly BackupRow[]) {
  const columns = BACKUP_TABLES[table];
  const placeholders = `(${columns.map(() => '?').join(', ')})`;
  for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
    const batch = rows.slice(i, i + ROWS_PER_INSERT);
    const params = batch.flatMap((row) => columns.map((c) => row[c] ?? null));
    await tx.run(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${batch.map(() => placeholders).join(', ')}`,
      params,
    );
  }
}

export const backupRepository = {
  /** Everything a backup contains. Call inside a transaction for a consistent snapshot. */
  async dumpAll(db: DbClient): Promise<BackupData> {
    const tables = {} as BackupTables;
    for (const table of PARENT_FIRST) {
      tables[TABLE_KEYS[table]] = await db.all<BackupRow>(
        `SELECT ${BACKUP_TABLES[table].join(', ')} FROM ${table} ORDER BY rowid`,
      );
    }
    return { settings: await settingsRepository.portableEntries(db), ...tables };
  },

  async counts(db: DbClient): Promise<Record<keyof BackupTables, number>> {
    const result = {} as Record<keyof BackupTables, number>;
    for (const table of PARENT_FIRST) {
      const row = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
      result[TABLE_KEYS[table]] = row?.n ?? 0;
    }
    return result;
  },

  /** Deletes every backed-up row. Must run inside a transaction. */
  async deleteAll(tx: DbClient): Promise<void> {
    for (const table of [...PARENT_FIRST].reverse()) await tx.run(`DELETE FROM ${table}`);
  },

  /** Replaces all backed-up tables and portable settings. Must run inside a transaction. */
  async replaceAll(tx: DbClient, data: BackupData, now: Date): Promise<void> {
    await backupRepository.deleteAll(tx);
    for (const table of PARENT_FIRST) await insertRows(tx, table, data[TABLE_KEYS[table]]);
    await settingsRepository.replacePortable(tx, data.settings, now);
  },

  /** Batched inserts with the backup column list (restore; dev tools test data). */
  insertRows,

  /** Number of rows that break a foreign key (PRAGMA foreign_key_check). */
  async foreignKeyViolations(db: DbClient): Promise<number> {
    return (await db.all('PRAGMA foreign_key_check')).length;
  },
};
