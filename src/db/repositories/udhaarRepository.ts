// Udhaar entries (UDHAAR.md, UDH-02, UDH-04, UDH-05; FINANCIAL_RULES.md §4). Nothing here
// touches transactions: udhaar is never income or expense (FR-4.4, UDH-12).

import type { DbClient } from '@/db/client';
import { mapSqliteError } from '@/db/sqlErrors';
import {
  PAYMENT_METHODS,
  UDHAAR_DIRECTIONS,
  type DateRange,
  type LocalDate,
  type PaymentMethod,
  type UdhaarDirection,
  type UdhaarEntry,
  type UdhaarEntryWithBalance,
  type UdhaarEntryWithPerson,
  type UdhaarTotals,
} from '@/db/types';
import { runningBalances, udhaarTotals } from '@/lib/balance';
import { isValidLocalDate, toIsoDateTime } from '@/lib/dates';
import { AppError } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { assertPaise, type Paise } from '@/lib/money';

interface EntryRow {
  id: string;
  person_id: string;
  direction: UdhaarDirection;
  amount_paise: number;
  entry_date: string;
  payment_method: PaymentMethod;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewUdhaarEntry {
  personId: string;
  direction: UdhaarDirection;
  amountPaise: Paise;
  entryDate: LocalDate;
  paymentMethod: PaymentMethod;
  note?: string | null;
}

export type UdhaarEntryPatch = Partial<Omit<NewUdhaarEntry, 'personId'>>;

const toEntry = (row: EntryRow): UdhaarEntry => ({
  id: row.id,
  personId: row.person_id,
  direction: row.direction,
  amountPaise: row.amount_paise,
  entryDate: row.entry_date,
  paymentMethod: row.payment_method,
  note: row.note,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Oldest first: the order running balances are computed in. */
const CHRONOLOGICAL = 'ORDER BY entry_date, created_at, id';

function validate(input: Omit<NewUdhaarEntry, 'personId'>): Omit<NewUdhaarEntry, 'personId'> {
  if (!UDHAAR_DIRECTIONS.includes(input.direction)) {
    throw new AppError('VALIDATION', 'Unknown direction', { detail: 'DIRECTION' });
  }
  assertPaise(input.amountPaise);
  if (!isValidLocalDate(input.entryDate)) {
    throw new AppError('VALIDATION', 'Invalid date', { detail: 'INVALID_DATE' });
  }
  if (!PAYMENT_METHODS.includes(input.paymentMethod)) {
    throw new AppError('VALIDATION', 'Unknown payment method', { detail: 'PAYMENT_METHOD' });
  }
  const note = input.note?.trim() ?? '';
  if (note.length > 500) {
    throw new AppError('VALIDATION', 'Note longer than 500 characters', { detail: 'note.max' });
  }
  return { ...input, note: note === '' ? null : note };
}

async function requireEntry(db: DbClient, id: string): Promise<EntryRow> {
  const row = await db.get<EntryRow>('SELECT * FROM udhaar_entries WHERE id = ?', [id]);
  if (!row) throw new AppError('NOT_FOUND', 'Entry not found', { detail: 'UDHAAR_ENTRY' });
  return row;
}

function withBalances(rowsAsc: readonly EntryRow[]): UdhaarEntryWithBalance[] {
  const entries = rowsAsc.map(toEntry);
  const balances = runningBalances(entries);
  return entries.map((e, i) => ({ ...e, balanceAfterPaise: balances[i] ?? 0 }));
}

export const udhaarRepository = {
  /** UDH-04: newest first, each with the balance right after it. */
  async listByPerson(db: DbClient, personId: string): Promise<UdhaarEntryWithBalance[]> {
    const rows = await db.all<EntryRow>(
      `SELECT * FROM udhaar_entries WHERE person_id = ? ${CHRONOLOGICAL}`,
      [personId],
    );
    return withBalances(rows).reverse();
  },

  async getById(db: DbClient, id: string): Promise<UdhaarEntry | null> {
    const row = await db.get<EntryRow>('SELECT * FROM udhaar_entries WHERE id = ?', [id]);
    return row ? toEntry(row) : null;
  },

  /** The person's balance, optionally leaving one entry out (editing it). */
  async balanceOf(db: DbClient, personId: string, exceptEntryId?: string): Promise<Paise> {
    const row = await db.get<{ balance: number }>(
      `SELECT COALESCE(SUM(CASE direction WHEN 'gave' THEN amount_paise ELSE -amount_paise END), 0) AS balance
       FROM udhaar_entries WHERE person_id = ? AND id IS NOT ?`,
      [personId, exceptEntryId ?? null],
    );
    return row?.balance ?? 0;
  },

  async create(db: DbClient, input: NewUdhaarEntry, now: Date): Promise<UdhaarEntry> {
    const e = validate(input);
    const person = await db.get('SELECT id FROM people WHERE id = ?', [input.personId]);
    if (!person) throw new AppError('NOT_FOUND', 'Person not found', { detail: 'PERSON' });
    const id = newId();
    const ts = toIsoDateTime(now);
    try {
      await db.run(
        `INSERT INTO udhaar_entries (id, person_id, direction, amount_paise, entry_date, payment_method, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.personId,
          e.direction,
          e.amountPaise,
          e.entryDate,
          e.paymentMethod,
          e.note ?? null,
          ts,
          ts,
        ],
      );
    } catch (error) {
      throw mapSqliteError(error);
    }
    return toEntry(await requireEntry(db, id));
  },

  async update(db: DbClient, id: string, patch: UdhaarEntryPatch, now: Date): Promise<UdhaarEntry> {
    const current = toEntry(await requireEntry(db, id));
    const e = validate({
      direction: patch.direction ?? current.direction,
      amountPaise: patch.amountPaise ?? current.amountPaise,
      entryDate: patch.entryDate ?? current.entryDate,
      paymentMethod: patch.paymentMethod ?? current.paymentMethod,
      note: patch.note !== undefined ? patch.note : current.note,
    });
    try {
      await db.run(
        `UPDATE udhaar_entries SET direction = ?, amount_paise = ?, entry_date = ?, payment_method = ?, note = ?, updated_at = ?
         WHERE id = ?`,
        [
          e.direction,
          e.amountPaise,
          e.entryDate,
          e.paymentMethod,
          e.note ?? null,
          toIsoDateTime(now),
          id,
        ],
      );
    } catch (error) {
      throw mapSqliteError(error);
    }
    return toEntry(await requireEntry(db, id));
  },

  async delete(db: DbClient, id: string): Promise<UdhaarEntry> {
    const row = await requireEntry(db, id);
    await db.run('DELETE FROM udhaar_entries WHERE id = ?', [id]);
    return toEntry(row);
  },

  /** FR-4.9 dashboard totals across all people (archived people are always settled). */
  async totals(db: DbClient): Promise<UdhaarTotals> {
    const rows = await db.all<{ balance: number }>(
      `SELECT SUM(CASE direction WHEN 'gave' THEN amount_paise ELSE -amount_paise END) AS balance
       FROM udhaar_entries GROUP BY person_id`,
    );
    return udhaarTotals(rows.map((r) => r.balance));
  },

  /** RPT-05: every entry with its person and the balance after it, oldest first. */
  async listAll(db: DbClient, range?: DateRange): Promise<UdhaarEntryWithPerson[]> {
    const rows = await db.all<EntryRow & { person_name: string }>(
      `SELECT e.*, p.name AS person_name FROM udhaar_entries e JOIN people p ON p.id = e.person_id
       ORDER BY e.person_id, e.entry_date, e.created_at, e.id`,
    );
    const byPerson = new Map<string, (EntryRow & { person_name: string })[]>();
    for (const row of rows) {
      const list = byPerson.get(row.person_id) ?? [];
      list.push(row);
      byPerson.set(row.person_id, list);
    }
    const all: UdhaarEntryWithPerson[] = [];
    for (const personRows of byPerson.values()) {
      withBalances(personRows).forEach((e, i) =>
        all.push({ ...e, personName: personRows[i]?.person_name ?? '' }),
      );
    }
    return all
      .filter((e) => !range || (e.entryDate >= range.start && e.entryDate <= range.end))
      .sort(
        (a, b) =>
          a.entryDate.localeCompare(b.entryDate) ||
          a.createdAt.localeCompare(b.createdAt) ||
          a.id.localeCompare(b.id),
      );
  },
};
