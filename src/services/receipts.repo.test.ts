import type { DbClient } from '@/db/client';
import { attachmentRepository } from '@/db/repositories/attachmentRepository';
import { categoryRepository } from '@/db/repositories/categoryRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { transactionRepository } from '@/db/repositories/transactionRepository';
import { runHousekeepingIfDue } from '@/services/housekeeping';
import {
  createReceiptService,
  JPEG_QUALITY,
  MAX_EDGE_PX,
  MAX_INPUT_BYTES,
  MIN_FREE_BYTES,
  type ReceiptDraft,
} from '@/services/receiptService';
import { transactionService } from '@/services/transactionService';
import { CACHE, DOC, fakeImages, fakeReceiptFiles } from '@/test/fakeReceiptFiles';
import { createTestDb, fixedClock, TEST_NOW, TEST_TODAY } from '@/test/testDb';

let db: DbClient;
let fs: ReturnType<typeof fakeReceiptFiles>;
let img: ReturnType<typeof fakeImages>;
let receipts: ReturnType<typeof createReceiptService>;
const clock = fixedClock(TEST_NOW);

beforeEach(async () => {
  db = await createTestDb();
  fs = fakeReceiptFiles();
  img = fakeImages(fs, { 'content://small.png': { width: 800, height: 600 } });
  receipts = createReceiptService({ files: fs.store, images: img.images });
});

function picked(uri: string, extra: Record<string, unknown> = {}) {
  fs.put(uri, 4_000_000);
  return { uri, mimeType: 'image/jpeg', width: 0, height: 0, ...extra };
}

async function drafts(n: number): Promise<ReceiptDraft[]> {
  const out: ReceiptDraft[] = [];
  for (let i = 0; i < n; i++) out.push(await receipts.prepare(picked(`content://photo${i}.jpg`)));
  return out;
}

async function expenseInput() {
  const food = (await categoryRepository.list(db, { type: 'expense' })).find(
    (c) => c.name === 'Food & Dining',
  );
  return {
    type: 'expense' as const,
    amountPaise: 45000,
    categoryId: food!.id,
    txnDate: TEST_TODAY,
    paymentMethod: 'upi' as const,
  };
}

describe('prepare (import pipeline)', () => {
  test('compresses to JPEG ≤ 1600 px at quality 0.7 into cache/staging', async () => {
    const draft = await receipts.prepare(picked('content://photo.jpg'));
    expect(img.calls[0]).toEqual({
      uri: 'content://photo.jpg',
      maxEdge: MAX_EDGE_PX,
      quality: JPEG_QUALITY,
    });
    expect(draft).toMatchObject({ width: 1600, height: 1200, sizeBytes: 300_000 });
    expect(draft.stagedUri.startsWith(`${CACHE}staging/`)).toBe(true);
    expect(fs.files.has(draft.stagedUri)).toBe(true);
  });

  test('never upscales a small image', async () => {
    const draft = await receipts.prepare(picked('content://small.png', { mimeType: 'image/png' }));
    expect(draft).toMatchObject({ width: 800, height: 600 });
  });

  test.each(['application/pdf', 'video/mp4'])('rejects %s', async (mimeType) => {
    await expect(receipts.prepare(picked('content://x', { mimeType }))).rejects.toMatchObject({
      code: 'UNSUPPORTED_FILE',
    });
  });

  test('accepts HEIC by extension when the type is unknown', async () => {
    await expect(
      receipts.prepare(picked('content://a', { mimeType: undefined, fileName: 'IMG_1.HEIC' })),
    ).resolves.toBeDefined();
  });

  test('rejects images over 25 MB', async () => {
    await expect(
      receipts.prepare(picked('content://big.jpg', { fileSize: MAX_INPUT_BYTES + 1 })),
    ).rejects.toMatchObject({ code: 'VALIDATION', detail: 'TOO_LARGE' });
  });

  test('refuses when less than 50 MB is free', async () => {
    fs.setFree(MIN_FREE_BYTES - 1);
    await expect(receipts.prepare(picked('content://p.jpg'))).rejects.toMatchObject({
      code: 'STORAGE_FULL',
    });
  });

  test('a decoding failure is reported, nothing is staged', async () => {
    img.setFail(true);
    await expect(receipts.prepare(picked('content://p.jpg'))).rejects.toMatchObject({
      detail: 'COMPRESS_FAILED',
    });
    expect(fs.stagingUris()).toEqual([]);
  });

  test('discarding a draft deletes its staged file', async () => {
    const [draft] = await drafts(1);
    receipts.discard([draft!]);
    expect(fs.stagingUris()).toEqual([]);
  });
});

describe('saving with a transaction (RCP-01, RCP-03)', () => {
  test('create stores files as receipts/<id>.jpg and inserts rows', async () => {
    const t = await transactionService.create(db, clock, await expenseInput(), {
      receipts,
      add: await drafts(2),
    });
    const rows = await attachmentRepository.listByTransaction(db, t.id);
    expect(rows).toHaveLength(2);
    expect(fs.receiptUris().sort()).toEqual(rows.map((r) => `${DOC}${r.relativePath}`).sort());
    expect(fs.stagingUris()).toEqual([]);
    expect(receipts.resolveUri(rows[0]!.relativePath)).toBe(`${DOC}${rows[0]!.relativePath}`);
  });

  test('if the DB write fails, files go back to staging and Save can be retried', async () => {
    const pending = await drafts(2);
    const bad = { ...(await expenseInput()), categoryId: 'missing' };
    await expect(
      transactionService.create(db, clock, bad, { receipts, add: pending }),
    ).rejects.toThrow();
    expect(fs.receiptUris()).toEqual([]);
    expect(fs.stagingUris().sort()).toEqual(pending.map((d) => d.stagedUri).sort());
    expect((await transactionRepository.summary(db, {}, TEST_TODAY)).count).toBe(0);

    const t = await transactionService.create(db, clock, await expenseInput(), {
      receipts,
      add: pending,
    });
    expect(await attachmentRepository.listByTransaction(db, t.id)).toHaveLength(2);
  });

  test('if a move fails half-way, the moved files go back to staging', async () => {
    const pending = await drafts(2);
    fs.files.delete(pending[1]!.stagedUri); // second move will fail
    await expect(receipts.store(pending)).rejects.toThrow();
    expect(fs.receiptUris()).toEqual([]);
    expect(fs.stagingUris()).toEqual([pending[0]!.stagedUri]);
  });

  test('more than 5 receipts is refused before anything is stored', async () => {
    await expect(
      transactionService.create(db, clock, await expenseInput(), {
        receipts,
        add: await drafts(6),
      }),
    ).rejects.toMatchObject({ detail: 'MAX_ATTACHMENTS' });
    expect(fs.receiptUris()).toEqual([]);
  });

  test('edit: remove one and add one in a single save; removed file deleted after commit', async () => {
    const t = await transactionService.create(db, clock, await expenseInput(), {
      receipts,
      add: await drafts(2),
    });
    const [first, second] = await attachmentRepository.listByTransaction(db, t.id);
    await transactionService.update(
      db,
      clock,
      t.id,
      { amountPaise: 50000 },
      {
        receipts,
        add: await drafts(1),
        remove: [first!.id],
      },
    );
    const after = await attachmentRepository.listByTransaction(db, t.id);
    expect(after.map((a) => a.id)).toContain(second!.id);
    expect(after.map((a) => a.id)).not.toContain(first!.id);
    expect(after).toHaveLength(2);
    expect(fs.files.has(`${DOC}${first!.relativePath}`)).toBe(false);
    expect(fs.receiptUris()).toHaveLength(2);
  });

  test('edit that would exceed 5 is rolled back and the new files removed', async () => {
    const t = await transactionService.create(db, clock, await expenseInput(), {
      receipts,
      add: await drafts(4),
    });
    await expect(
      transactionService.update(db, clock, t.id, {}, { receipts, add: await drafts(2) }),
    ).rejects.toMatchObject({ detail: 'MAX_ATTACHMENTS' });
    expect(await attachmentRepository.listByTransaction(db, t.id)).toHaveLength(4);
    expect(fs.receiptUris()).toHaveLength(4);
    expect(fs.stagingUris()).toHaveLength(2); // the 2 new drafts are back in staging
  });

  test('deleting a receipt of another transaction is refused', async () => {
    const a = await transactionService.create(db, clock, await expenseInput(), {
      receipts,
      add: await drafts(1),
    });
    const b = await transactionService.create(db, clock, await expenseInput(), {
      receipts,
      add: await drafts(1),
    });
    const [bReceipt] = await attachmentRepository.listByTransaction(db, b.id);
    await expect(
      transactionService.update(db, clock, a.id, {}, { receipts, remove: [bReceipt!.id] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await attachmentRepository.listByTransaction(db, b.id)).toHaveLength(1);
  });

  test('TXN-03 deleting the transaction deletes its receipt files', async () => {
    const t = await transactionService.create(db, clock, await expenseInput(), {
      receipts,
      add: await drafts(2),
    });
    await transactionService.delete(db, clock, t.id, receipts);
    expect(fs.receiptUris()).toEqual([]);
    expect(await attachmentRepository.allRelativePaths(db)).toEqual(new Set());
  });
});

describe('viewer actions (RCP-05) and missing files (RCP-06)', () => {
  test('replace keeps the position, swaps the row, deletes the old file', async () => {
    const t = await transactionService.create(db, clock, await expenseInput(), {
      receipts,
      add: await drafts(3),
    });
    const before = await attachmentRepository.listByTransaction(db, t.id);
    const [newDraft] = await drafts(1);
    const created = await receipts.replace(db, clock, before[1]!.id, newDraft!);
    const after = await attachmentRepository.listByTransaction(db, t.id);
    expect(after.map((a) => a.id)).toEqual([before[0]!.id, created.id, before[2]!.id]);
    expect(fs.files.has(`${DOC}${before[1]!.relativePath}`)).toBe(false);
    expect(fs.receiptUris()).toHaveLength(3);
  });

  test('replace of a missing attachment removes the new file and fails', async () => {
    const [d] = await drafts(1);
    await expect(receipts.replace(db, clock, 'nope', d!)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(fs.receiptUris()).toEqual([]);
  });

  test('remove deletes row then file and marks data changed', async () => {
    const t = await transactionService.create(db, clock, await expenseInput(), {
      receipts,
      add: await drafts(1),
    });
    const [a] = await attachmentRepository.listByTransaction(db, t.id);
    await settingsRepository.set(db, 'data_changed_since_backup', false, TEST_NOW);
    await receipts.remove(db, clock, a!.id);
    expect(fs.receiptUris()).toEqual([]);
    expect(await settingsRepository.get(db, 'data_changed_since_backup')).toBe(true);
  });

  test('a file missing on disk resolves to null; unsafe paths too', async () => {
    const t = await transactionService.create(db, clock, await expenseInput(), {
      receipts,
      add: await drafts(1),
    });
    const [a] = await attachmentRepository.listByTransaction(db, t.id);
    fs.files.delete(`${DOC}${a!.relativePath}`);
    expect(receipts.resolveUri(a!.relativePath)).toBeNull();
    expect(receipts.resolveUri('../secret.db')).toBeNull();
  });
});

describe('orphan sweep (RCP-07)', () => {
  const HOUR = 60 * 60 * 1000;
  const now = TEST_NOW.getTime();

  test('deletes old unreferenced receipts and old staging files only', async () => {
    const t = await transactionService.create(db, clock, await expenseInput(), {
      receipts,
      add: await drafts(1),
    });
    const [kept] = await attachmentRepository.listByTransaction(db, t.id);
    fs.put(`${DOC}receipts/${kept!.id}.jpg`, 1000, now - 30 * 24 * HOUR); // referenced, old
    fs.put(`${DOC}receipts/aaaaaaaa-0000-4000-8000-000000000001.jpg`, 1000, now - 2 * HOUR); // orphan, old
    fs.put(`${DOC}receipts/aaaaaaaa-0000-4000-8000-000000000002.jpg`, 1000, now - 10 * 60 * 1000); // orphan, new
    fs.put(`${CACHE}staging/old.jpg`, 1000, now - 25 * HOUR);
    fs.put(`${CACHE}staging/new.jpg`, 1000, now - HOUR);
    fs.put(`${DOC}hisaab.db`, 1000, 0); // outside receipts/: never touched

    expect(await receipts.sweepOrphans(db, TEST_NOW)).toEqual({ receipts: 1, staging: 1 });
    expect(fs.files.has(`${DOC}receipts/${kept!.id}.jpg`)).toBe(true);
    expect(fs.files.has(`${DOC}receipts/aaaaaaaa-0000-4000-8000-000000000001.jpg`)).toBe(false);
    expect(fs.files.has(`${DOC}receipts/aaaaaaaa-0000-4000-8000-000000000002.jpg`)).toBe(true);
    expect(fs.stagingUris()).toEqual([`${CACHE}staging/new.jpg`]);
    expect(fs.files.has(`${DOC}hisaab.db`)).toBe(true);
  });

  test('housekeeping runs at most once every 7 days', async () => {
    expect(await runHousekeepingIfDue(db, clock, receipts)).toBe(true);
    expect(
      await runHousekeepingIfDue(db, fixedClock(new Date(now + 6 * 24 * HOUR)), receipts),
    ).toBe(false);
    expect(
      await runHousekeepingIfDue(db, fixedClock(new Date(now + 8 * 24 * HOUR)), receipts),
    ).toBe(true);
    // Device-only bookkeeping must not trigger the backup nudge.
    expect(await settingsRepository.get(db, 'data_changed_since_backup')).toBe(false);
  });
});
