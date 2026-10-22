// Transaction use cases (SERVICES_AND_LIBS.md). Receipts join in Phase 5.

import { notifyChanged } from '@/db/changes';
import type { DbClient } from '@/db/client';
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

const CHANGED = ['transactions', 'transaction_attachments', 'app_settings'] as const;

export const transactionService = {
  async create(db: DbClient, clock: Clock, input: NewTransaction): Promise<Transaction> {
    const now = clock.now();
    const created = await db.transaction(async (tx) => {
      const t = await transactionRepository.create(tx, input, now);
      await markDataChanged(tx, now);
      return t;
    });
    notifyChanged(CHANGED);
    return created;
  },

  async update(
    db: DbClient,
    clock: Clock,
    id: string,
    patch: TransactionPatch,
  ): Promise<Transaction> {
    const now = clock.now();
    const updated = await db.transaction(async (tx) => {
      const t = await transactionRepository.update(tx, id, patch, now);
      await markDataChanged(tx, now);
      return t;
    });
    notifyChanged(CHANGED);
    return updated;
  },

  /** Returns receipt paths; from Phase 5 the receipt files are deleted after commit. */
  async delete(db: DbClient, clock: Clock, id: string): Promise<{ attachmentPaths: string[] }> {
    const now = clock.now();
    const result = await db.transaction(async (tx) => {
      const r = await transactionRepository.delete(tx, id);
      await markDataChanged(tx, now);
      return r;
    });
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
