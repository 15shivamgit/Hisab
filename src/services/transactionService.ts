// Transaction use cases (SERVICES_AND_LIBS.md). Receipt files are stored before the DB
// transaction and removed again if it fails; files of deleted rows go after commit.

import { notifyChanged } from '@/db/changes';
import type { DbClient } from '@/db/client';
import {
  attachmentRepository,
  MAX_ATTACHMENTS_PER_TRANSACTION,
} from '@/db/repositories/attachmentRepository';
import { markDataChanged } from '@/db/repositories/settingsRepository';
import {
  transactionRepository,
  type NewTransaction,
  type TransactionPatch,
} from '@/db/repositories/transactionRepository';
import type { Transaction } from '@/db/types';
import type { Clock } from '@/lib/clock';
import { todayLocal } from '@/lib/dates';
import { AppError } from '@/lib/errors';
import type { ReceiptDraft, ReceiptService, StoredReceipt } from '@/services/receiptService';

const CHANGED = ['transactions', 'transaction_attachments', 'app_settings'] as const;

/** Receipt changes made in the form; applied only when the form is saved (RECEIPTS.md). */
export interface ReceiptChanges {
  receipts: ReceiptService;
  add?: readonly ReceiptDraft[];
  /** Attachment ids to remove (edit form). */
  remove?: readonly string[];
}

function tooMany(): AppError {
  return new AppError('VALIDATION', 'A transaction can have at most 5 receipts', {
    detail: 'MAX_ATTACHMENTS',
  });
}

export const transactionService = {
  async create(
    db: DbClient,
    clock: Clock,
    input: NewTransaction,
    changes?: ReceiptChanges,
  ): Promise<Transaction> {
    const now = clock.now();
    const drafts = changes?.add ?? [];
    if (drafts.length > MAX_ATTACHMENTS_PER_TRANSACTION) throw tooMany();
    const stored: StoredReceipt[] = changes ? await changes.receipts.store(drafts) : [];
    try {
      const created = await db.transaction(async (tx) => {
        const t = await transactionRepository.create(tx, input, now);
        for (const receipt of stored) {
          await attachmentRepository.insert(tx, { ...receipt, transactionId: t.id }, now);
        }
        await markDataChanged(tx, now);
        return t;
      });
      notifyChanged(CHANGED);
      return created;
    } catch (error) {
      // Back to staging, so the form keeps its photos and Save can be retried.
      await changes?.receipts.unstore(stored, drafts);
      throw error;
    }
  },

  async update(
    db: DbClient,
    clock: Clock,
    id: string,
    patch: TransactionPatch,
    changes?: ReceiptChanges,
  ): Promise<Transaction> {
    const now = clock.now();
    const stored: StoredReceipt[] = changes ? await changes.receipts.store(changes.add ?? []) : [];
    let removedPaths: string[] = [];
    try {
      const updated = await db.transaction(async (tx) => {
        const t = await transactionRepository.update(tx, id, patch, now);
        removedPaths = [];
        for (const attachmentId of changes?.remove ?? []) {
          const { relativePath } = await attachmentRepository.deleteForTransaction(
            tx,
            id,
            attachmentId,
          );
          removedPaths.push(relativePath);
        }
        const remaining = (await attachmentRepository.listByTransaction(tx, id)).length;
        if (remaining + stored.length > MAX_ATTACHMENTS_PER_TRANSACTION) throw tooMany();
        for (const receipt of stored) {
          await attachmentRepository.insert(tx, { ...receipt, transactionId: id }, now);
        }
        await markDataChanged(tx, now);
        return t;
      });
      changes?.receipts.deleteFiles(removedPaths);
      notifyChanged(CHANGED);
      return updated;
    } catch (error) {
      await changes?.receipts.unstore(stored, changes.add ?? []);
      throw error;
    }
  },

  /** TXN-03: deletes the row (and its receipt rows), then the receipt files. */
  async delete(
    db: DbClient,
    clock: Clock,
    id: string,
    receipts?: ReceiptService,
  ): Promise<{ attachmentPaths: string[] }> {
    const now = clock.now();
    const result = await db.transaction(async (tx) => {
      const r = await transactionRepository.delete(tx, id);
      await markDataChanged(tx, now);
      return r;
    });
    receipts?.deleteFiles(result.attachmentPaths);
    notifyChanged(CHANGED);
    return result;
  },

  /**
   * TXN-10: a form draft copied from an existing transaction — today's date, no receipts.
   * Nothing is saved until the user saves the form.
   */
  async duplicate(db: DbClient, clock: Clock, id: string): Promise<NewTransaction> {
    const source = await transactionRepository.getById(db, id);
    if (!source)
      throw new AppError('NOT_FOUND', 'Transaction not found', { detail: 'TRANSACTION' });
    return {
      type: source.type,
      amountPaise: source.amountPaise,
      categoryId: source.categoryId,
      txnDate: todayLocal(clock.now()),
      paymentMethod: source.paymentMethod,
      description: source.description,
      notes: source.notes,
    };
  },
};
