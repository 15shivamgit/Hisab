import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { createHash } from 'node:crypto';

import type { DbClient } from '@/db/client';
import { attachmentRepository } from '@/db/repositories/attachmentRepository';
import { backupRepository } from '@/db/repositories/backupRepository';
import { budgetRepository } from '@/db/repositories/budgetRepository';
import { personRepository } from '@/db/repositories/personRepository';
import { udhaarRepository } from '@/db/repositories/udhaarRepository';
import { categoryRepository } from '@/db/repositories/categoryRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { transactionRepository } from '@/db/repositories/transactionRepository';
import { isAppError } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { sha256Hex } from '@/platform/hash';
import { createBackupService } from '@/services/backup/backupService';
import { createReceiptService } from '@/services/receiptService';
import { CACHE, DOC, fakeImages, fakeReceiptFiles } from '@/test/fakeReceiptFiles';
import { memoryBackupFiles } from '@/test/memoryBackupFiles';
import { createTestDb, fixedClock, TEST_NOW, TEST_TODAY } from '@/test/testDb';

const clock = fixedClock(TEST_NOW);
const later = fixedClock(new Date(TEST_NOW.getTime() + 60_000));

/** One "phone": its own database, files, and backup service. */
async function phone(options: { pauseAt?: (stage: 'db' | 'files') => Promise<void> } = {}) {
  const db = await createTestDb();
  const fs = memoryBackupFiles();
  const receipts = createReceiptService({
    files: fs.receiptStore,
    images: fakeImages(fakeReceiptFiles()).images,
  });
  const service = createBackupService({
    files: fs.store,
    sha256: sha256Hex,
    sweepOrphans: (d, now) => receipts.sweepOrphans(d, now),
    appVersion: '1.0.0',
    ...options,
  });
  return { db, fs, service };
}
type Phone = Awaited<ReturnType<typeof phone>>;

async function category(db: DbClient, name: string) {
  return (await categoryRepository.list(db, {})).find((c) => c.name === name)!;
}

/** Adds an expense with `receipts` receipt files (bytes contain the attachment id). */
async function addExpense(p: Phone, amountPaise: number, receipts = 0) {
  const food = await category(p.db, 'Food & Dining');
  const txn = await transactionRepository.create(
    p.db,
    {
      type: 'expense',
      amountPaise,
      categoryId: food.id,
      txnDate: TEST_TODAY,
      paymentMethod: 'upi',
      description: `Lunch ${amountPaise}`,
    },
    TEST_NOW,
  );
  for (let i = 0; i < receipts; i++) {
    const id = newId();
    const bytes = strToU8(`jpeg-bytes-${id}-PK\u0007\u0008-inside`);
    p.fs.put(`${DOC}receipts/${id}.jpg`, bytes);
    await attachmentRepository.insert(
      p.db,
      { id, transactionId: txn.id, sizeBytes: bytes.length, width: 1200, height: 1600 },
      TEST_NOW,
    );
  }
  return txn;
}

async function seedSample(p: Phone) {
  await addExpense(p, 45000, 2);
  await addExpense(p, 12000, 0);
  const salary = await category(p.db, 'Salary');
  await transactionRepository.create(
    p.db,
    {
      type: 'income',
      amountPaise: 5_000_000,
      categoryId: salary.id,
      txnDate: TEST_TODAY,
      paymentMethod: 'bank_transfer',
    },
    TEST_NOW,
  );
  await budgetRepository.upsertOverall(p.db, 2_000_000, TEST_NOW);
  await settingsRepository.set(p.db, 'theme', 'dark', TEST_NOW);
}

/** The backup file's entries, for tampering. */
async function entriesOf(p: Phone, uri: string) {
  return unzipSync(await p.fs.store.readAll(uri));
}

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Writes a crafted archive onto the phone and returns its URI. */
function putArchive(p: Phone, entries: Zippable, name = 'picked.hisaab') {
  const uri = `${CACHE}picked/${name}`;
  p.fs.put(uri, zipSync(entries));
  return uri;
}

function editJson(entries: Record<string, Uint8Array>, name: string, edit: (v: any) => void) {
  const value = JSON.parse(strFromU8(entries[name]!));
  edit(value);
  entries[name] = strToU8(JSON.stringify(value));
}

/** After changing data.json, fix the checksum so only the change under test is wrong. */
function resealData(entries: Record<string, Uint8Array>) {
  editJson(entries, 'manifest.json', (m) => {
    m.dataSha256 = sha(entries['data.json']!);
  });
}

async function expectRejected(p: Phone, uri: string, detail: string) {
  const before = await backupRepository.dumpAll(p.db);
  const receiptsBefore = p.fs.uris(`${DOC}receipts/`);
  const error = await p.service.inspect(p.db, uri, 'file').catch((e: unknown) => e);
  expect(isAppError(error) && error.detail).toBe(detail);
  expect(await backupRepository.dumpAll(p.db)).toEqual(before);
  expect(p.fs.uris(`${DOC}receipts/`)).toEqual(receiptsBefore);
  expect(p.fs.uris(`${CACHE}staging/`)).toEqual([]);
}

describe('create (BAK-01)', () => {
  test('writes manifest, data, and every receipt with checksums', async () => {
    const a = await phone();
    await seedSample(a);
    const result = await a.service.create(a.db, clock);

    expect(result.fileName).toMatch(/^hisaab-backup-2026-10-21-\d{4}\.hisaab$/);
    expect(result.uri).toBe(`${CACHE}exports/${result.fileName}`);
    expect(result.counts).toEqual({
      categories: 21,
      transactions: 3,
      attachments: 2,
      budgets: 1,
      people: 0,
      udhaarEntries: 0,
    });
    expect(result.missingFiles).toBe(0);

    const entries = await entriesOf(a, result.uri);
    expect(Object.keys(entries).sort()).toEqual(
      [
        'data.json',
        'manifest.json',
        ...a.fs.uris(`${DOC}receipts/`).map((u) => u.slice(DOC.length)),
      ].sort(),
    );
    const manifest = JSON.parse(strFromU8(entries['manifest.json']!));
    expect(manifest).toMatchObject({
      format: 'hisaab-backup',
      formatVersion: 1,
      schemaVersion: 2,
      appVersion: '1.0.0',
      dataSha256: sha(entries['data.json']!),
      missingFiles: [],
    });
    for (const f of manifest.files) expect(f.sha256).toBe(sha(entries[f.path]!));
    const data = JSON.parse(strFromU8(entries['data.json']!));
    expect(data.settings).toEqual({
      theme: 'dark',
      week_start: 'monday',
      reminders_enabled: true,
      reminder_time: '09:00',
    });
    expect(data.transactions[0]).toHaveProperty('amount_paise', 45000);
    expect(a.fs.uris(`${CACHE}exports/`)).toEqual([result.uri]); // no .partial left
  });

  test('a missing receipt file is listed in missingFiles and its row is kept', async () => {
    const a = await phone();
    await addExpense(a, 100, 2);
    const [gone] = a.fs.uris(`${DOC}receipts/`);
    a.fs.store.remove(gone!);
    const result = await a.service.create(a.db, clock);
    expect(result.missingFiles).toBe(1);
    const manifest = JSON.parse(strFromU8((await entriesOf(a, result.uri))['manifest.json']!));
    expect(manifest.missingFiles).toEqual([gone!.slice(DOC.length)]);
    expect(manifest.counts.attachments).toBe(2);
  });

  test('refuses when free space is below the estimate × 1.2', async () => {
    const a = await phone();
    await seedSample(a);
    a.fs.setFree(1000);
    await expect(a.service.create(a.db, clock)).rejects.toMatchObject({ code: 'STORAGE_FULL' });
    expect(a.fs.uris(`${CACHE}exports/`)).toEqual([]);
  });

  test('markBackedUp records the time and clears the changed flag', async () => {
    const a = await phone();
    await settingsRepository.set(a.db, 'data_changed_since_backup', true, TEST_NOW);
    await a.service.markBackedUp(a.db, clock);
    expect(await settingsRepository.get(a.db, 'last_backup_at')).toBe(TEST_NOW.toISOString());
    expect(await settingsRepository.get(a.db, 'data_changed_since_backup')).toBe(false);
  });
});

describe('restore round trip (BAK-02, BAK-04)', () => {
  test('phone A → phone B: identical data, receipts, and portable settings only', async () => {
    const a = await phone();
    await seedSample(a);
    const backup = await a.service.create(a.db, clock);

    const b = await phone();
    await addExpense(b, 999, 1); // B's own data, to be replaced
    await settingsRepository.set(b.db, 'app_lock_enabled', true, TEST_NOW); // device-only
    const bOldReceipt = b.fs.uris(`${DOC}receipts/`)[0]!;
    const picked = `${CACHE}DocumentPicker/x.hisaab`;
    b.fs.put(picked, await a.fs.store.readAll(backup.uri));

    const report = await b.service.inspect(b.db, picked, 'file');
    expect(report.counts).toEqual(backup.counts);
    expect(report.createdAt).toBe(TEST_NOW.toISOString());
    await b.service.restore(b.db, later, report);

    const { settings: aSettings, ...aTables } = await backupRepository.dumpAll(a.db);
    const { settings: bSettings, ...bTables } = await backupRepository.dumpAll(b.db);
    expect(bTables).toEqual(aTables);
    expect(bSettings).toEqual(aSettings);
    expect(await settingsRepository.get(b.db, 'app_lock_enabled')).toBe(true);
    expect(await settingsRepository.get(b.db, 'data_changed_since_backup')).toBe(false);

    // Every attachment row has its file, with the same bytes; B's old receipt is gone.
    const aFiles = a.fs.uris(`${DOC}receipts/`);
    expect(b.fs.uris(`${DOC}receipts/`)).toEqual(aFiles);
    for (const uri of aFiles)
      expect(b.fs.files.get(uri)?.bytes).toEqual(a.fs.files.get(uri)?.bytes);
    expect(b.fs.files.has(bOldReceipt)).toBe(false);

    // Cleaned up: no journal, staging, or temporary folders; one safety backup.
    expect(b.fs.uris(`${CACHE}staging/`)).toEqual([]);
    expect(b.fs.store.exists(`${DOC}restore-journal.json`)).toBe(false);
    expect(b.fs.store.exists(`${DOC}receipts-incoming`)).toBe(false);
    expect(b.fs.store.exists(`${DOC}receipts-old`)).toBe(false);
    expect(b.fs.store.list(`${DOC}backups`)).toHaveLength(1);
  });

  test('the safety backup brings the old data back ("Undo last restore")', async () => {
    const a = await phone();
    await seedSample(a);
    const backup = await a.service.create(a.db, clock);
    const b = await phone();
    await addExpense(b, 777, 1);
    const bBefore = await backupRepository.dumpAll(b.db);
    const bReceipts = b.fs.uris(`${DOC}receipts/`);
    b.fs.put(`${CACHE}p.hisaab`, await a.fs.store.readAll(backup.uri));
    await b.service.restore(b.db, later, await b.service.inspect(b.db, `${CACHE}p.hisaab`, 'file'));

    const safety = b.service.safetyBackupUri();
    expect(safety).toMatch(/backups\/pre-restore-.*\.hisaab$/);
    await b.service.restore(b.db, later, await b.service.inspect(b.db, safety!, 'undo'));

    const { settings: _s, ...tables } = await backupRepository.dumpAll(b.db);
    const { settings: _o, ...oldTables } = bBefore;
    expect(tables).toEqual(oldTables);
    expect(b.fs.uris(`${DOC}receipts/`)).toEqual(bReceipts);
    // The undo source lives only inside the app, so it counts as not backed up.
    expect(await settingsRepository.get(b.db, 'data_changed_since_backup')).toBe(true);
  });

  test('a backup with no receipts removes the current receipts', async () => {
    const a = await phone();
    const backup = await a.service.create(a.db, clock);
    const b = await phone();
    await addExpense(b, 5, 2);
    b.fs.put(`${CACHE}p.hisaab`, await a.fs.store.readAll(backup.uri));
    await b.service.restore(b.db, later, await b.service.inspect(b.db, `${CACHE}p.hisaab`, 'file'));
    expect(b.fs.uris(`${DOC}receipts/`)).toEqual([]);
    expect(await backupRepository.counts(b.db)).toMatchObject({
      transactions: 0,
      transactionAttachments: 0,
    });
  });

  test('a receipt listed in missingFiles restores as a row without a file', async () => {
    const a = await phone();
    await addExpense(a, 100, 2);
    const [gone] = a.fs.uris(`${DOC}receipts/`);
    a.fs.store.remove(gone!);
    const backup = await a.service.create(a.db, clock);
    const b = await phone();
    b.fs.put(`${CACHE}p.hisaab`, await a.fs.store.readAll(backup.uri));
    const report = await b.service.inspect(b.db, `${CACHE}p.hisaab`, 'file');
    expect(report.missingFiles).toBe(1);
    await b.service.restore(b.db, later, report);
    expect(await backupRepository.counts(b.db)).toMatchObject({ transactionAttachments: 2 });
    expect(b.fs.uris(`${DOC}receipts/`)).toHaveLength(1);
    expect(b.fs.files.has(gone!)).toBe(false);
  });

  test('discard after inspect removes the staged files and changes nothing', async () => {
    const a = await phone();
    await seedSample(a);
    const backup = await a.service.create(a.db, clock);
    const report = await a.service.inspect(a.db, backup.uri, 'file');
    expect(a.fs.uris(`${CACHE}staging/`).length).toBeGreaterThan(0);
    a.service.discard(report);
    expect(a.fs.uris(`${CACHE}staging/`)).toEqual([]);
  });
});

describe('inspect rejects bad files without changing anything (BAK-03)', () => {
  let a: Phone;
  let good: Record<string, Uint8Array>;

  beforeEach(async () => {
    a = await phone();
    await seedSample(a);
    good = await entriesOf(a, (await a.service.create(a.db, clock)).uri);
  });

  test('a text file renamed to .hisaab', async () => {
    a.fs.put(`${CACHE}picked/notes.hisaab`, strToU8('hello, this is not a backup'));
    await expectRejected(a, `${CACHE}picked/notes.hisaab`, 'NOT_BACKUP');
  });

  test('a truncated backup', async () => {
    const bytes = zipSync(good);
    a.fs.put(`${CACHE}picked/cut.hisaab`, bytes.slice(0, Math.floor(bytes.length / 2)));
    await expectRejected(a, `${CACHE}picked/cut.hisaab`, 'NOT_BACKUP');
  });

  test('some other ZIP file', async () => {
    await expectRejected(a, putArchive(a, { 'photo.jpg': strToU8('x') }), 'DAMAGED');
    await expectRejected(a, putArchive(a, { 'data.json': strToU8('{}') }), 'NOT_BACKUP');
  });

  test('a manifest from another app', async () => {
    editJson(good, 'manifest.json', (m) => {
      m.format = 'other-app';
    });
    await expectRejected(a, putArchive(a, good), 'NOT_BACKUP');
  });

  test('a newer format or schema version', async () => {
    editJson(good, 'manifest.json', (m) => {
      m.formatVersion = 2;
    });
    await expectRejected(a, putArchive(a, good), 'NEWER_VERSION');
    editJson(good, 'manifest.json', (m) => {
      m.formatVersion = 1;
      m.schemaVersion = 99;
    });
    await expectRejected(a, putArchive(a, good), 'NEWER_VERSION');
  });

  test('tampered data.json (checksum)', async () => {
    editJson(good, 'data.json', (d) => {
      d.transactions[0].amount_paise = 1;
    });
    await expectRejected(a, putArchive(a, good), 'DAMAGED');
  });

  test('tampered receipt (checksum)', async () => {
    const receipt = Object.keys(good).find((k) => k.startsWith('receipts/'))!;
    good[receipt] = strToU8('swapped image');
    await expectRejected(a, putArchive(a, good), 'DAMAGED');
  });

  test('zip-slip and extra entries', async () => {
    await expectRejected(a, putArchive(a, { ...good, '../evil.jpg': strToU8('x') }), 'DAMAGED');
    await expectRejected(
      a,
      putArchive(a, { ...good, 'receipts/../../evil.jpg': strToU8('x') }),
      'DAMAGED',
    );
    await expectRejected(a, putArchive(a, { ...good, 'readme.txt': strToU8('x') }), 'DAMAGED');
    await expectRejected(
      a,
      putArchive(a, { ...good, 'receipts\\evil.jpg': strToU8('x') }),
      'DAMAGED',
    );
  });

  test('invalid rows: wrong types, bad enum, float paise, extra columns', async () => {
    const cases: ((d: any) => void)[] = [
      (d) => (d.transactions[0].amount_paise = 12.5),
      (d) => (d.transactions[0].payment_method = 'cheque'),
      (d) => (d.transactions[0].txn_date = '2026-02-30'),
      (d) => (d.transactions[0].id = 'not-a-uuid'),
      (d) => (d.transactions[0].extra = 'x'),
      (d) => (d.categories = 'nope'),
    ];
    for (const change of cases) {
      const entries = { ...good };
      editJson(entries, 'data.json', change);
      resealData(entries);
      await expectRejected(a, putArchive(a, entries), 'DAMAGED');
    }
  });

  test('broken references and file bookkeeping', async () => {
    const receipt = Object.keys(good).find((k) => k.startsWith('receipts/'))!;
    const cases: ((e: Record<string, Uint8Array>) => void)[] = [
      // Transaction points at a missing category.
      (e) => editJson(e, 'data.json', (d) => (d.transactions[0].category_id = newId())),
      // Expense row in an income category.
      (e) =>
        editJson(e, 'data.json', (d) => {
          d.transactions[0].category_id = d.categories.find((c: any) => c.type === 'income').id;
        }),
      // Attachment row whose file is neither in the archive nor listed as missing.
      (e) => {
        delete e[receipt];
        editJson(e, 'manifest.json', (m) => {
          m.files = m.files.filter((f: any) => f.path !== receipt);
        });
      },
      // Counts don't match.
      (e) => editJson(e, 'manifest.json', (m) => (m.counts.transactions = 99)),
    ];
    for (const change of cases) {
      const entries = { ...good };
      change(entries);
      resealData(entries);
      await expectRejected(a, putArchive(a, entries), 'DAMAGED');
    }
  });

  test('not enough free space for the safety backup + extracted files', async () => {
    // 45 MB of receipts that compress to almost nothing: cheap to copy, big to extract.
    const big: Zippable = { ...good };
    for (let i = 0; i < 5; i++)
      big[`receipts/${newId()}.jpg`] = [new Uint8Array(9 * 1024 * 1024), { level: 6 }];
    const uri = putArchive(a, big);
    a.fs.setFree(a.fs.store.size(uri)! + 51 * 1024 * 1024);
    const before = await backupRepository.dumpAll(a.db);
    const error = await a.service.inspect(a.db, uri, 'file').catch((e: unknown) => e);
    expect(isAppError(error) && error.code).toBe('STORAGE_FULL');
    expect(await backupRepository.dumpAll(a.db)).toEqual(before);
  });
});

describe('failures and crash recovery (BAK-05)', () => {
  async function setup(pauseAt?: (stage: 'db' | 'files') => Promise<void>) {
    const a = await phone();
    await seedSample(a);
    const backup = await a.service.create(a.db, clock);
    const b = await phone({ pauseAt });
    await addExpense(b, 321, 1);
    const before = await backupRepository.dumpAll(b.db);
    const receiptsBefore = b.fs.uris(`${DOC}receipts/`);
    b.fs.put(`${CACHE}p.hisaab`, await a.fs.store.readAll(backup.uri));
    const report = await b.service.inspect(b.db, `${CACHE}p.hisaab`, 'file');
    return { a, b, report, before, receiptsBefore };
  }

  const crash = (at: 'db' | 'files') => async (stage: 'db' | 'files') => {
    if (stage === at) throw new Error('app killed');
  };

  test('safety backup fails → nothing changes', async () => {
    const { b, report, before, receiptsBefore } = await setup();
    b.fs.failWhen('backups/');
    await expect(b.service.restore(b.db, later, report)).rejects.toMatchObject({
      detail: 'SAFETY_BACKUP_FAILED',
    });
    expect(await backupRepository.dumpAll(b.db)).toEqual(before);
    expect(b.fs.uris(`${DOC}receipts/`)).toEqual(receiptsBefore);
  });

  test('DB step fails → rolled back, old data and receipts intact', async () => {
    const { b, report, before, receiptsBefore } = await setup();
    report.data.transactions[0]!.category_id = newId(); // passes nothing at the DB
    await expect(b.service.restore(b.db, later, report)).rejects.toMatchObject({
      detail: 'RESTORE_FAILED',
    });
    expect(await backupRepository.dumpAll(b.db)).toEqual(before);
    expect(b.fs.uris(`${DOC}receipts/`)).toEqual(receiptsBefore);
    expect(b.fs.store.exists(`${DOC}restore-journal.json`)).toBe(false);
    expect(b.fs.store.exists(`${DOC}receipts-incoming`)).toBe(false);
  });

  test('killed before the DB commit → next start rolls back to the old data', async () => {
    const { b, report, before, receiptsBefore } = await setup(crash('db'));
    await expect(b.service.restore(b.db, later, report)).rejects.toThrow('app killed');
    expect(await b.service.recoverIfInterrupted(b.db, later)).toBe('rolled-back');
    expect(await backupRepository.dumpAll(b.db)).toEqual(before);
    expect(b.fs.uris(`${DOC}receipts/`)).toEqual(receiptsBefore);
    expect(
      b.fs
        .uris(`${DOC}`)
        .filter((u) => !u.startsWith(`${DOC}receipts/`) && !u.startsWith(`${DOC}backups/`)),
    ).toEqual([]);
    expect(b.fs.uris(`${CACHE}staging/`)).toEqual([]);
  });

  test('killed after the DB commit → next start finishes with the new data', async () => {
    const { a, b, report } = await setup(crash('files'));
    await expect(b.service.restore(b.db, later, report)).rejects.toThrow('app killed');
    expect(await b.service.recoverIfInterrupted(b.db, later)).toBe('finished');
    const { settings: _a, ...aTables } = await backupRepository.dumpAll(a.db);
    const { settings: _b, ...bTables } = await backupRepository.dumpAll(b.db);
    expect(bTables).toEqual(aTables);
    expect(b.fs.uris(`${DOC}receipts/`)).toEqual(a.fs.uris(`${DOC}receipts/`));
    expect(b.fs.store.exists(`${DOC}receipts-old`)).toBe(false);
    expect(b.fs.store.exists(`${DOC}restore-journal.json`)).toBe(false);
  });

  test('killed in the middle of the folder swap → recovery completes it', async () => {
    const { a, b, report } = await setup(crash('files'));
    await expect(b.service.restore(b.db, later, report)).rejects.toThrow('app killed');
    // Simulate: receipts/ already renamed to receipts-old/, incoming not yet moved.
    await b.fs.store.move(`${DOC}receipts`, `${DOC}receipts-old`);
    expect(await b.service.recoverIfInterrupted(b.db, later)).toBe('finished');
    expect(b.fs.uris(`${DOC}receipts/`)).toEqual(a.fs.uris(`${DOC}receipts/`));
    expect(b.fs.store.exists(`${DOC}receipts-old`)).toBe(false);
    // Running recovery again is harmless.
    expect(await b.service.recoverIfInterrupted(b.db, later)).toBe('none');
    expect(b.fs.uris(`${DOC}receipts/`)).toEqual(a.fs.uris(`${DOC}receipts/`));
  });

  test('startup with no journal clears leftover restore staging', async () => {
    const { b } = await setup();
    expect(b.fs.uris(`${CACHE}staging/`).length).toBeGreaterThan(0);
    expect(await b.service.recoverIfInterrupted(b.db, later)).toBe('none');
    expect(b.fs.uris(`${CACHE}staging/`)).toEqual([]);
  });
});

describe('udhaar in backups (schema 2)', () => {
  async function seedUdhaar(p: Phone) {
    const rahul = await personRepository.create(
      p.db,
      { name: 'Rahul', phone: '9876543210' },
      TEST_NOW,
    );
    await personRepository.update(p.db, rahul.id, { returnByDate: '2026-10-25' }, TEST_NOW);
    await udhaarRepository.create(
      p.db,
      {
        personId: rahul.id,
        direction: 'gave',
        amountPaise: 1_000_000,
        entryDate: TEST_TODAY,
        paymentMethod: 'upi',
        note: 'Hospital',
      },
      TEST_NOW,
    );
    await udhaarRepository.create(
      p.db,
      {
        personId: rahul.id,
        direction: 'got',
        amountPaise: 300_000,
        entryDate: TEST_TODAY,
        paymentMethod: 'cash',
      },
      TEST_NOW,
    );
  }

  test('people and entries round trip with their balances', async () => {
    const a = await phone();
    await seedSample(a);
    await seedUdhaar(a);
    const backup = await a.service.create(a.db, clock);
    expect(backup.counts).toMatchObject({ people: 1, udhaarEntries: 2 });

    const b = await phone();
    b.fs.put(`${CACHE}p.hisaab`, await a.fs.store.readAll(backup.uri));
    await b.service.restore(b.db, later, await b.service.inspect(b.db, `${CACHE}p.hisaab`, 'file'));
    const { settings: _a, ...aTables } = await backupRepository.dumpAll(a.db);
    const { settings: _b, ...bTables } = await backupRepository.dumpAll(b.db);
    expect(bTables).toEqual(aTables);
    expect(await udhaarRepository.totals(b.db)).toMatchObject({ youWillGetPaise: 700_000 });
  });

  test('a schema-1 backup (before udhaar) restores into this app and clears people', async () => {
    const a = await phone();
    await seedSample(a);
    const entries = await entriesOf(a, (await a.service.create(a.db, clock)).uri);
    // Turn it into what Phase 6 wrote: no people/udhaar keys, schemaVersion 1.
    editJson(entries, 'data.json', (d) => {
      delete d.people;
      delete d.udhaarEntries;
    });
    editJson(entries, 'manifest.json', (m) => {
      m.schemaVersion = 1;
      delete m.counts.people;
      delete m.counts.udhaarEntries;
    });
    resealData(entries);

    const b = await phone();
    await seedUdhaar(b);
    const report = await b.service.inspect(b.db, putArchive(b, entries), 'file');
    expect(report.counts).toMatchObject({ transactions: 3, people: 0, udhaarEntries: 0 });
    await b.service.restore(b.db, later, report);
    expect(await backupRepository.counts(b.db)).toMatchObject({
      transactions: 3,
      people: 0,
      udhaarEntries: 0,
    });
  });

  test('an udhaar entry whose person is missing is rejected', async () => {
    const a = await phone();
    await seedUdhaar(a);
    const entries = await entriesOf(a, (await a.service.create(a.db, clock)).uri);
    editJson(entries, 'data.json', (d) => {
      d.udhaarEntries[0].person_id = newId();
    });
    resealData(entries);
    await expectRejected(a, putArchive(a, entries), 'DAMAGED');
  });
});
