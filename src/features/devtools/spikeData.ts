// Debug builds only. Synthetic data for the Phase 6 backup spike (BACKUP_AND_RESTORE.md
// § Phase 6 spike): N transactions, some with a receipt-sized file of random bytes
// (random bytes don't compress, like real JPEGs).

import { notifyChanged } from '@/db/changes';
import type { DbClient } from '@/db/client';
import { backupRepository, type BackupRow } from '@/db/repositories/backupRepository';
import { addDays, todayLocal, toIsoDateTime } from '@/lib/dates';
import { newId } from '@/lib/ids';
import type { BackupFiles } from '@/platform/backupFiles';

function randomBytes(length: number, seed: number): Uint8Array {
  const out = new Uint8Array(length);
  let x = seed | 1;
  for (let i = 0; i < length; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    out[i] = x & 0xff;
  }
  return out;
}

export async function seedSpikeData(
  db: DbClient,
  files: BackupFiles,
  options: { transactions: number; receipts: number; receiptBytes: number },
  now: Date,
): Promise<void> {
  const categories = await db.all<{ id: string }>(
    "SELECT id FROM categories WHERE type = 'expense' AND archived_at IS NULL",
  );
  const ts = toIsoDateTime(now);
  const today = todayLocal(now);
  const transactions: BackupRow[] = [];
  const attachments: BackupRow[] = [];
  for (let i = 0; i < options.transactions; i++) {
    const id = newId();
    transactions.push({
      id,
      type: 'expense',
      amount_paise: 100 + ((i * 7919) % 500_000),
      category_id: categories[i % categories.length]?.id ?? null,
      txn_date: addDays(today, -(i % 730)),
      payment_method: 'upi',
      description: `Spike entry ${i + 1}`,
      notes: null,
      created_at: ts,
      updated_at: ts,
    });
    if (i < options.receipts) {
      const attachmentId = newId();
      const path = `receipts/${attachmentId}.jpg`;
      await files.writeAll(files.documentUri(path), randomBytes(options.receiptBytes, i + 1));
      attachments.push({
        id: attachmentId,
        transaction_id: id,
        relative_path: path,
        mime_type: 'image/jpeg',
        size_bytes: options.receiptBytes,
        width: 1200,
        height: 1600,
        sort_order: 0,
        created_at: ts,
      });
    }
  }
  await db.transaction(async (tx) => {
    await backupRepository.insertRows(tx, 'transactions', transactions);
    await backupRepository.insertRows(tx, 'transaction_attachments', attachments);
  });
  notifyChanged('all');
}
