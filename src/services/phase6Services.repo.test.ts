import { strFromU8, strToU8 } from 'fflate';

import { attachmentRepository } from '@/db/repositories/attachmentRepository';
import { backupRepository } from '@/db/repositories/backupRepository';
import { budgetRepository } from '@/db/repositories/budgetRepository';
import { categoryRepository } from '@/db/repositories/categoryRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { transactionRepository } from '@/db/repositories/transactionRepository';
import { newId } from '@/lib/ids';
import { backupNudgeFor, backupNudgeService } from '@/services/backupNudge';
import { createDataService } from '@/services/dataService';
import { createExportService } from '@/services/exportService';
import { CACHE, DOC } from '@/test/fakeReceiptFiles';
import { memoryBackupFiles } from '@/test/memoryBackupFiles';
import { createTestDb, fixedClock, TEST_NOW } from '@/test/testDb';

const clock = fixedClock(TEST_NOW);

async function categoryId(db: Awaited<ReturnType<typeof createTestDb>>, name: string) {
  return (await categoryRepository.list(db, {})).find((c) => c.name === name)!.id;
}

describe('transactions CSV (RPT-04)', () => {
  test('columns, plain rupee amounts, receipt counts, oldest first, range filter', async () => {
    const db = await createTestDb();
    const fs = memoryBackupFiles();
    const food = await categoryId(db, 'Food & Dining');
    const salary = await categoryId(db, 'Salary');
    const lunch = await transactionRepository.create(
      db,
      {
        type: 'expense',
        amountPaise: 123450,
        categoryId: food,
        txnDate: '2026-10-21',
        paymentMethod: 'upi',
        description: '=chai, samosa',
        notes: 'दफ़्तर',
      },
      TEST_NOW,
    );
    await attachmentRepository.insert(
      db,
      { id: newId(), transactionId: lunch.id, sizeBytes: 10, width: 1, height: 1 },
      TEST_NOW,
    );
    await transactionRepository.create(
      db,
      {
        type: 'income',
        amountPaise: 5_000_000,
        categoryId: salary,
        txnDate: '2026-10-01',
        paymentMethod: 'bank_transfer',
      },
      TEST_NOW,
    );
    await transactionRepository.create(
      db,
      {
        type: 'expense',
        amountPaise: 100,
        categoryId: food,
        txnDate: '2026-09-30',
        paymentMethod: 'cash',
      },
      TEST_NOW,
    );

    const result = await createExportService(fs.store).transactionsCsv(db, {
      start: '2026-10-01',
      end: '2026-10-31',
    });
    expect(result).toMatchObject({
      fileName: 'hisaab-transactions-2026-10-01_to_2026-10-31.csv',
      rows: 2,
    });
    const bytes = fs.files.get(result!.uri)!.bytes;
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM for Excel
    const lines = strFromU8(bytes.slice(3)).split('\r\n');
    expect(lines[0]).toBe(
      'date,type,amount_inr,category,payment_method,description,notes,receipts,id',
    );
    expect(lines[1]).toMatch(
      /^2026-10-01,income,50000\.00,Salary,bank_transfer,,,0,[0-9a-f-]{36}$/,
    );
    expect(lines[2]).toBe(
      `2026-10-21,expense,1234.50,Food & Dining,upi,"'=chai, samosa",दफ़्तर,1,${lunch.id}`,
    );
  });

  test('all entries uses the first and last dates; nothing to export returns null', async () => {
    const db = await createTestDb();
    const fs = memoryBackupFiles();
    const exporter = createExportService(fs.store);
    expect(await exporter.transactionsCsv(db, null)).toBeNull();
    const food = await categoryId(db, 'Food & Dining');
    for (const date of ['2025-01-05', '2026-10-21']) {
      await transactionRepository.create(
        db,
        {
          type: 'expense',
          amountPaise: 100,
          categoryId: food,
          txnDate: date,
          paymentMethod: 'cash',
        },
        TEST_NOW,
      );
    }
    const old = fs.store.cacheUri('exports/old.csv');
    fs.put(old, strToU8('x'));
    const result = await exporter.transactionsCsv(db, null);
    expect(result?.fileName).toBe('hisaab-transactions-2025-01-05_to_2026-10-21.csv');
    expect(fs.store.exists(old)).toBe(false); // previous exports cleared
  });
});

describe('backup nudge (DASH-08)', () => {
  const now = new Date('2026-10-21T10:00:00+05:30');
  const base = {
    dataChangedSinceBackup: true,
    lastBackupAt: null,
    dismissedUntil: null,
    entryCount: 10,
  };

  test('never backed up: shown from 10 entries', () => {
    expect(backupNudgeFor(base, now)).toEqual({ daysSince: null });
    expect(backupNudgeFor({ ...base, entryCount: 9 }, now)).toBeNull();
  });

  test('last backup older than 7 days', () => {
    const eightDaysAgo = new Date(now.getTime() - 8 * 86_400_000).toISOString();
    const sixDaysAgo = new Date(now.getTime() - 6 * 86_400_000).toISOString();
    expect(backupNudgeFor({ ...base, lastBackupAt: eightDaysAgo, entryCount: 1 }, now)).toEqual({
      daysSince: 8,
    });
    expect(backupNudgeFor({ ...base, lastBackupAt: sixDaysAgo }, now)).toBeNull();
  });

  test('hidden when nothing changed or while dismissed', () => {
    expect(backupNudgeFor({ ...base, dataChangedSinceBackup: false }, now)).toBeNull();
    expect(backupNudgeFor({ ...base, dismissedUntil: '2026-10-21' }, now)).toBeNull();
    expect(backupNudgeFor({ ...base, dismissedUntil: '2026-10-20' }, now)).toEqual({
      daysSince: null,
    });
  });

  test('dismiss hides it for 3 days', async () => {
    const db = await createTestDb();
    await backupNudgeService.dismiss(db, clock);
    expect(await settingsRepository.get(db, 'backup_nudge_dismissed_until')).toBe('2026-10-24');
  });
});

describe('delete all data (SET-06)', () => {
  test('removes entries, receipts, safety backup, staging, exports; keeps settings', async () => {
    const db = await createTestDb();
    const fs = memoryBackupFiles();
    const food = await categoryId(db, 'Food & Dining');
    const txn = await transactionRepository.create(
      db,
      {
        type: 'expense',
        amountPaise: 100,
        categoryId: food,
        txnDate: '2026-10-21',
        paymentMethod: 'cash',
      },
      TEST_NOW,
    );
    const id = newId();
    await attachmentRepository.insert(
      db,
      { id, transactionId: txn.id, sizeBytes: 1, width: 1, height: 1 },
      TEST_NOW,
    );
    await budgetRepository.upsertOverall(db, 1000, TEST_NOW);
    await categoryRepository.create(
      db,
      { name: 'Pets', type: 'expense', icon: 'pets', color: 'cat.red' },
      TEST_NOW,
    );
    for (const uri of [
      `${DOC}receipts/${id}.jpg`,
      `${DOC}backups/pre-restore-1.hisaab`,
      `${CACHE}staging/x.jpg`,
      `${CACHE}exports/a.csv`,
    ]) {
      fs.put(uri, strToU8('x'));
    }
    await settingsRepository.set(db, 'theme', 'dark', TEST_NOW);
    await settingsRepository.set(db, 'last_backup_at', '2026-10-01T00:00:00.000Z', TEST_NOW);
    await settingsRepository.set(db, 'data_changed_since_backup', true, TEST_NOW);
    await settingsRepository.set(db, 'backup_nudge_dismissed_until', '2026-10-22', TEST_NOW);

    await createDataService(fs.store).deleteAllData(db, clock);

    expect(await backupRepository.counts(db)).toEqual({
      categories: 21,
      transactions: 0,
      transactionAttachments: 0,
      budgets: 0,
    });
    expect((await categoryRepository.list(db, {})).some((c) => c.name === 'Pets')).toBe(false);
    expect(fs.uris()).toEqual([]);
    expect(await settingsRepository.get(db, 'theme')).toBe('dark');
    expect(await settingsRepository.get(db, 'last_backup_at')).toBe('2026-10-01T00:00:00.000Z');
    expect(await settingsRepository.get(db, 'data_changed_since_backup')).toBe(false);
    expect(await settingsRepository.get(db, 'backup_nudge_dismissed_until')).toBeNull();
  });
});
