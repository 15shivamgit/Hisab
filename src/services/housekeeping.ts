// Background tasks after startup (ARCHITECTURE.md § Startup sequence, step 6).
// Phase 5: the receipt orphan sweep, at most once every 7 days.

import type { DbClient } from '@/db/client';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import type { Clock } from '@/lib/clock';
import type { ReceiptService } from '@/services/receiptService';

export const SWEEP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/** Returns true if the sweep ran. Device-only setting, so it doesn't mark data as changed. */
export async function runHousekeepingIfDue(
  db: DbClient,
  clock: Clock,
  receipts: ReceiptService,
): Promise<boolean> {
  const now = clock.now();
  const last = await settingsRepository.get(db, 'last_orphan_sweep_at');
  if (last && now.getTime() - new Date(last).getTime() < SWEEP_INTERVAL_MS) return false;
  await receipts.sweepOrphans(db, now);
  await settingsRepository.set(db, 'last_orphan_sweep_at', now.toISOString(), now);
  return true;
}
