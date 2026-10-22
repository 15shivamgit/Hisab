// Category use cases (CATEGORIES.md). Every write marks data as changed for the backup nudge.

import { notifyChanged } from '@/db/changes';
import type { DbClient } from '@/db/client';
import {
  categoryRepository,
  type CategoryPatch,
  type NewCategory,
} from '@/db/repositories/categoryRepository';
import { markDataChanged } from '@/db/repositories/settingsRepository';
import type { Category } from '@/db/types';
import type { Clock } from '@/lib/clock';

async function write<T>(
  db: DbClient,
  clock: Clock,
  work: (tx: DbClient, now: Date) => Promise<T>,
  alsoChanged: ('budgets' | 'transactions')[] = [],
): Promise<T> {
  const now = clock.now();
  const result = await db.transaction(async (tx) => {
    const r = await work(tx, now);
    await markDataChanged(tx, now);
    return r;
  });
  notifyChanged(['categories', 'app_settings', ...alsoChanged]);
  return result;
}

export const categoryService = {
  create(db: DbClient, clock: Clock, input: NewCategory): Promise<Category> {
    return write(db, clock, (tx, now) => categoryRepository.create(tx, input, now));
  },

  /** Renames show up on old transactions too, so lists of transactions refresh. */
  update(db: DbClient, clock: Clock, id: string, patch: CategoryPatch): Promise<Category> {
    return write(db, clock, (tx, now) => categoryRepository.update(tx, id, patch, now), [
      'transactions',
    ]);
  },

  setArchived(db: DbClient, clock: Clock, id: string, archived: boolean): Promise<Category> {
    return write(db, clock, (tx, now) => categoryRepository.setArchived(tx, id, archived, now));
  },

  /** Deletes an unused category; its budget (if any) goes with it. */
  delete(db: DbClient, clock: Clock, id: string): Promise<void> {
    return write(db, clock, (tx) => categoryRepository.delete(tx, id), ['budgets']);
  },

  move(db: DbClient, clock: Clock, id: string, direction: 'up' | 'down'): Promise<void> {
    return write(db, clock, (tx, now) => categoryRepository.move(tx, id, direction, now));
  },
};
