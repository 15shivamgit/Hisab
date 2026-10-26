// Transactions CSV (RPT-04, REPORTS_AND_EXPORT.md § CSV export). Written to cache/exports
// (old exports are cleared first); the screen opens the share sheet.

import { strToU8 } from 'fflate';

import type { DbClient } from '@/db/client';
import { transactionRepository } from '@/db/repositories/transactionRepository';
import type { DateRange } from '@/lib/dates';
import { toCsv } from '@/lib/csv';
import { paiseToRupeeString } from '@/lib/money';
import type { BackupFiles } from '@/platform/backupFiles';

const HEADERS = [
  'date',
  'type',
  'amount_inr',
  'category',
  'payment_method',
  'description',
  'notes',
  'receipts',
  'id',
] as const;

export interface CsvExport {
  uri: string;
  fileName: string;
  rows: number;
}

export function createExportService(files: BackupFiles) {
  return {
    /** null range = all entries. Returns null when there is nothing to export. */
    async transactionsCsv(db: DbClient, range: DateRange | null): Promise<CsvExport | null> {
      const items = await transactionRepository.list(
        db,
        { ...(range ? { range } : {}), sort: 'date_asc' },
        { limit: Number.MAX_SAFE_INTEGER, offset: 0 },
      );
      if (items.length === 0) return null;

      const rows = items.map((t) => [
        t.txnDate,
        t.type,
        paiseToRupeeString(t.amountPaise),
        t.categoryName,
        t.paymentMethod,
        t.description,
        t.notes,
        t.attachmentCount,
        t.id,
      ]);
      const first = items[0]!.txnDate;
      const last = items[items.length - 1]!.txnDate;
      const fileName = `hisaab-transactions-${range?.start ?? first}_to_${range?.end ?? last}.csv`;
      files.remove(files.cacheUri('exports'));
      const uri = files.cacheUri(`exports/${fileName}`);
      await files.writeAll(uri, strToU8(toCsv(HEADERS, rows)));
      return { uri, fileName, rows: rows.length };
    },
  };
}
