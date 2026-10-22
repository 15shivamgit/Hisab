// Receipt rows (RECEIPTS.md, RCP-01…07). Files are handled by receiptService (Phase 5);
// this repository only stores and returns relative paths.

import type { DbClient } from '@/db/client';
import { toAttachment } from '@/db/repositories/transactionRepository';
import { mapSqliteError } from '@/db/sqlErrors';
import type { Attachment } from '@/db/types';
import { toIsoDateTime } from '@/lib/dates';
import { AppError } from '@/lib/errors';
import { receiptRelativePath } from '@/lib/paths';

export const MAX_ATTACHMENTS_PER_TRANSACTION = 5;

export interface NewAttachment {
  /** Also names the file: receipts/<id>.jpg. */
  id: string;
  transactionId: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export const attachmentRepository = {
  async listByTransaction(db: DbClient, transactionId: string): Promise<Attachment[]> {
    const rows = await db.all<Parameters<typeof toAttachment>[0]>(
      'SELECT * FROM transaction_attachments WHERE transaction_id = ? ORDER BY sort_order, created_at',
      [transactionId],
    );
    return rows.map(toAttachment);
  },

  async insert(db: DbClient, input: NewAttachment, now: Date): Promise<Attachment> {
    const relativePath = receiptRelativePath(input.id);
    const row = await db.get<{ count: number; next: number }>(
      `SELECT COUNT(*) AS count, COALESCE(MAX(sort_order), -1) + 1 AS next
       FROM transaction_attachments WHERE transaction_id = ?`,
      [input.transactionId],
    );
    if ((row?.count ?? 0) >= MAX_ATTACHMENTS_PER_TRANSACTION) {
      throw new AppError('VALIDATION', 'A transaction can have at most 5 receipts', {
        detail: 'MAX_ATTACHMENTS',
      });
    }
    try {
      await db.run(
        `INSERT INTO transaction_attachments (id, transaction_id, relative_path, mime_type, size_bytes, width, height, sort_order, created_at)
         VALUES (?, ?, ?, 'image/jpeg', ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.transactionId,
          relativePath,
          input.sizeBytes,
          input.width,
          input.height,
          row?.next ?? 0,
          toIsoDateTime(now),
        ],
      );
    } catch (error) {
      throw mapSqliteError(error, 'ATTACHMENT_DUPLICATE');
    }
    const [created] = (
      await attachmentRepository.listByTransaction(db, input.transactionId)
    ).filter((a) => a.id === input.id);
    if (!created) throw new AppError('UNKNOWN', 'Attachment insert not visible');
    return created;
  },

  async delete(db: DbClient, id: string): Promise<{ relativePath: string }> {
    const row = await db.get<{ relative_path: string }>(
      'SELECT relative_path FROM transaction_attachments WHERE id = ?',
      [id],
    );
    if (!row) throw new AppError('NOT_FOUND', 'Attachment not found', { detail: 'ATTACHMENT' });
    await db.run('DELETE FROM transaction_attachments WHERE id = ?', [id]);
    return { relativePath: row.relative_path };
  },

  /** Sets sort_order to the position in `orderedIds`. Ids from other transactions are ignored. */
  async reorder(db: DbClient, transactionId: string, orderedIds: readonly string[]): Promise<void> {
    for (const [index, id] of orderedIds.entries()) {
      await db.run(
        'UPDATE transaction_attachments SET sort_order = ? WHERE id = ? AND transaction_id = ?',
        [index, id, transactionId],
      );
    }
  },

  /** For the orphan sweep and backup. */
  async allRelativePaths(db: DbClient): Promise<Set<string>> {
    const rows = await db.all<{ relative_path: string }>(
      'SELECT relative_path FROM transaction_attachments',
    );
    return new Set(rows.map((row) => row.relative_path));
  },
};
