// Transactions CSV (RPT-04) and udhaar CSV (RPT-05), REPORTS_AND_EXPORT.md § CSV export.
// Written to cache/exports (old exports are cleared first); the screen opens the share sheet.

import { strToU8 } from 'fflate';

import type { DbClient } from '@/db/client';
import { transactionRepository } from '@/db/repositories/transactionRepository';
import { udhaarRepository } from '@/db/repositories/udhaarRepository';
import { csvNumber, toCsv, type CsvCell } from '@/lib/csv';
import type { DateRange, LocalDate } from '@/lib/dates';
import { paiseToRupeeString } from '@/lib/money';
import type { BackupFiles } from '@/platform/backupFiles';

const TRANSACTION_HEADERS = [
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

const UDHAAR_HEADERS = [
  'date',
  'person',
  'direction',
  'amount_inr',
  'payment_method',
  'note',
  'person_balance_after',
  'id',
] as const;

export interface CsvExport {
  uri: string;
  fileName: string;
  rows: number;
}

const rupees = (paise: number) => csvNumber(paiseToRupeeString(paise));

export function createExportService(files: BackupFiles) {
  async function write(
    fileName: string,
    headers: readonly string[],
    rows: readonly (readonly CsvCell[])[],
  ): Promise<CsvExport> {
    files.remove(files.cacheUri('exports'));
    const uri = files.cacheUri(`exports/${fileName}`);
    await files.writeAll(uri, strToU8(toCsv(headers, rows)));
    return { uri, fileName, rows: rows.length };
  }

  return {
    /** null range = all entries. Returns null when there is nothing to export. */
    async transactionsCsv(db: DbClient, range: DateRange | null): Promise<CsvExport | null> {
      const items = await transactionRepository.list(
        db,
        { ...(range ? { range } : {}), sort: 'date_asc' },
        { limit: Number.MAX_SAFE_INTEGER, offset: 0 },
      );
      if (items.length === 0) return null;
      const first = items[0]!.txnDate;
      const last = items[items.length - 1]!.txnDate;
      return write(
        `hisaab-transactions-${range?.start ?? first}_to_${range?.end ?? last}.csv`,
        TRANSACTION_HEADERS,
        items.map((t) => [
          t.txnDate,
          t.type,
          rupees(t.amountPaise),
          t.categoryName,
          t.paymentMethod,
          t.description,
          t.notes,
          t.attachmentCount,
          t.id,
        ]),
      );
    },

    /** Every udhaar entry (archived people included), oldest first; null when empty. */
    async udhaarCsv(db: DbClient, today: LocalDate): Promise<CsvExport | null> {
      const entries = await udhaarRepository.listAll(db);
      if (entries.length === 0) return null;
      return write(
        `hisaab-udhaar-${today}.csv`,
        UDHAAR_HEADERS,
        entries.map((e) => [
          e.entryDate,
          e.personName,
          e.direction,
          rupees(e.amountPaise),
          e.paymentMethod,
          e.note,
          rupees(e.balanceAfterPaise),
          e.id,
        ]),
      );
    },
  };
}
