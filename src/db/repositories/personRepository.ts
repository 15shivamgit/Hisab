// People in the udhaar ledger (UDHAAR.md, UDH-01, UDH-03, UDH-07, UDH-10, UDH-11).
// Balances are derived from udhaar_entries on every read (FR-4.2).

import type { DbClient, SqlParam } from '@/db/client';
import { mapSqliteError } from '@/db/sqlErrors';
import type { LocalDate, PeopleFilter, PeopleSort, Person, PersonWithBalance } from '@/db/types';
import { balanceLabel, isDueSoon, isOverdue } from '@/lib/balance';
import { isValidLocalDate, toIsoDateTime } from '@/lib/dates';
import { AppError } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { normalizePhone } from '@/lib/phone';

interface PersonRow {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  return_by_date: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PersonBalanceRow extends PersonRow {
  balance: number;
  entry_count: number;
  last_entry_date: string | null;
}

export interface NewPerson {
  name: string;
  phone?: string | null;
  notes?: string | null;
}

export interface PersonPatch extends Partial<NewPerson> {
  returnByDate?: LocalDate | null;
}

export interface PeopleQuery {
  search?: string;
  filter?: PeopleFilter;
  sort?: PeopleSort;
  includeArchived?: boolean;
}

const toPerson = (row: PersonRow): Person => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  notes: row.notes,
  returnByDate: row.return_by_date,
  archivedAt: row.archived_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toWithBalance = (row: PersonBalanceRow, today: LocalDate): PersonWithBalance => ({
  ...toPerson(row),
  balancePaise: row.balance,
  label: balanceLabel(row.balance),
  entryCount: row.entry_count,
  lastEntryDate: row.last_entry_date,
  isOverdue: isOverdue(row.return_by_date, row.balance, today),
  isDueSoon: isDueSoon(row.return_by_date, row.balance, today),
});

const WITH_BALANCE = `
  SELECT p.*,
         COALESCE(SUM(CASE e.direction WHEN 'gave' THEN e.amount_paise ELSE -e.amount_paise END), 0) AS balance,
         COUNT(e.id) AS entry_count,
         MAX(e.entry_date) AS last_entry_date
  FROM people p
  LEFT JOIN udhaar_entries e ON e.person_id = p.id`;

function cleanName(value: string): string {
  const name = value.trim();
  if (name.length < 1 || name.length > 60) {
    throw new AppError('VALIDATION', 'Name must be 1–60 characters', { detail: 'person.name' });
  }
  return name;
}

function cleanPhone(value: string | null | undefined): string | null {
  const phone = normalizePhone(value);
  if (phone === 'invalid') {
    throw new AppError('VALIDATION', 'Phone must be 6–20 digits', { detail: 'person.phone' });
  }
  return phone;
}

function cleanNotes(value: string | null | undefined): string | null {
  const notes = value?.trim() ?? '';
  if (notes.length > 500) {
    throw new AppError('VALIDATION', 'Notes longer than 500 characters', {
      detail: 'person.notes',
    });
  }
  return notes === '' ? null : notes;
}

async function requirePerson(db: DbClient, id: string): Promise<PersonRow> {
  const row = await db.get<PersonRow>('SELECT * FROM people WHERE id = ?', [id]);
  if (!row) throw new AppError('NOT_FOUND', 'Person not found', { detail: 'PERSON' });
  return row;
}

async function balanceOfPerson(db: DbClient, id: string): Promise<number> {
  const row = await db.get<{ balance: number }>(
    `SELECT COALESCE(SUM(CASE direction WHEN 'gave' THEN amount_paise ELSE -amount_paise END), 0) AS balance
     FROM udhaar_entries WHERE person_id = ?`,
    [id],
  );
  return row?.balance ?? 0;
}

function matchesFilter(p: PersonWithBalance, filter: PeopleFilter): boolean {
  switch (filter) {
    case 'will_get':
      return p.balancePaise > 0;
    case 'owe':
      return p.balancePaise < 0;
    case 'settled':
      return p.balancePaise === 0;
    case 'overdue':
      return p.isOverdue;
    default:
      return true;
  }
}

const byName = (a: Person, b: Person) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

const SORTERS: Record<PeopleSort, (a: PersonWithBalance, b: PersonWithBalance) => number> = {
  amount_desc: (a, b) => Math.abs(b.balancePaise) - Math.abs(a.balancePaise) || byName(a, b),
  name_asc: byName,
  recent: (a, b) =>
    (b.lastEntryDate ?? b.createdAt).localeCompare(a.lastEntryDate ?? a.createdAt) || byName(a, b),
};

export const personRepository = {
  async listWithBalances(
    db: DbClient,
    query: PeopleQuery,
    today: LocalDate,
  ): Promise<PersonWithBalance[]> {
    const where: string[] = [];
    const params: SqlParam[] = [];
    if (!query.includeArchived) where.push('p.archived_at IS NULL');
    const search = query.search?.trim();
    if (search) {
      where.push("p.name LIKE ? ESCAPE '\\'");
      params.push(`%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    }
    const rows = await db.all<PersonBalanceRow>(
      `${WITH_BALANCE} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} GROUP BY p.id`,
      params,
    );
    return rows
      .map((row) => toWithBalance(row, today))
      .filter((p) => matchesFilter(p, query.filter ?? 'all'))
      .sort(SORTERS[query.sort ?? 'amount_desc']);
  },

  async getWithBalance(
    db: DbClient,
    id: string,
    today: LocalDate,
  ): Promise<PersonWithBalance | null> {
    const row = await db.get<PersonBalanceRow>(`${WITH_BALANCE} WHERE p.id = ? GROUP BY p.id`, [
      id,
    ]);
    return row ? toWithBalance(row, today) : null;
  },

  async count(db: DbClient): Promise<number> {
    return (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM people'))?.n ?? 0;
  },

  /** Active people with exactly this name (case-insensitive) — for the duplicate warning. */
  async sameNameCount(db: DbClient, name: string, exceptId?: string): Promise<number> {
    const row = await db.get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM people WHERE name = ? COLLATE NOCASE AND archived_at IS NULL AND id IS NOT ?',
      [name.trim(), exceptId ?? null],
    );
    return row?.n ?? 0;
  },

  async create(db: DbClient, input: NewPerson, now: Date): Promise<Person> {
    const id = newId();
    const ts = toIsoDateTime(now);
    try {
      await db.run(
        `INSERT INTO people (id, name, phone, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, cleanName(input.name), cleanPhone(input.phone), cleanNotes(input.notes), ts, ts],
      );
    } catch (error) {
      throw mapSqliteError(error);
    }
    return toPerson(await requirePerson(db, id));
  },

  async update(db: DbClient, id: string, patch: PersonPatch, now: Date): Promise<Person> {
    const current = await requirePerson(db, id);
    if (patch.returnByDate && !isValidLocalDate(patch.returnByDate)) {
      throw new AppError('VALIDATION', 'Invalid date', { detail: 'INVALID_DATE' });
    }
    try {
      await db.run(
        `UPDATE people SET name = ?, phone = ?, notes = ?, return_by_date = ?, updated_at = ? WHERE id = ?`,
        [
          patch.name !== undefined ? cleanName(patch.name) : current.name,
          patch.phone !== undefined ? cleanPhone(patch.phone) : current.phone,
          patch.notes !== undefined ? cleanNotes(patch.notes) : current.notes,
          patch.returnByDate !== undefined ? patch.returnByDate : current.return_by_date,
          toIsoDateTime(now),
          id,
        ],
      );
    } catch (error) {
      throw mapSqliteError(error);
    }
    return toPerson(await requirePerson(db, id));
  },

  /** UDH-11 / FIN-U15: only a settled person can be archived. */
  async setArchived(db: DbClient, id: string, archived: boolean, now: Date): Promise<Person> {
    await requirePerson(db, id);
    if (archived && (await balanceOfPerson(db, id)) !== 0) {
      throw new AppError('VALIDATION', 'Only a settled person can be archived', {
        detail: 'PERSON_NOT_SETTLED',
      });
    }
    const ts = toIsoDateTime(now);
    await db.run('UPDATE people SET archived_at = ?, updated_at = ? WHERE id = ?', [
      archived ? ts : null,
      ts,
      id,
    ]);
    return toPerson(await requirePerson(db, id));
  },

  /** UDH-11 / FIN-U14: a person with entries can't be deleted. */
  async delete(db: DbClient, id: string): Promise<void> {
    await requirePerson(db, id);
    const row = await db.get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM udhaar_entries WHERE person_id = ?',
      [id],
    );
    if ((row?.n ?? 0) > 0) {
      throw new AppError('IN_USE', 'Person has entries', { detail: 'PERSON_HAS_ENTRIES' });
    }
    await db.run('DELETE FROM people WHERE id = ?', [id]);
  },

  /** FIN-U16: return-by date today or later and money still open. */
  async reminderCandidates(
    db: DbClient,
    today: LocalDate,
  ): Promise<{ personId: string; name: string; balancePaise: number; returnByDate: LocalDate }[]> {
    const rows = await db.all<PersonBalanceRow>(
      `${WITH_BALANCE} WHERE p.return_by_date >= ? GROUP BY p.id HAVING balance != 0`,
      [today],
    );
    return rows.map((r) => ({
      personId: r.id,
      name: r.name,
      balancePaise: r.balance,
      returnByDate: r.return_by_date as LocalDate,
    }));
  },
};
