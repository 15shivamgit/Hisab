// Udhaar use cases (UDHAAR.md, SERVICES_AND_LIBS.md § udhaarService). Every write marks
// data as changed for the backup nudge, notifies screens, then re-plans reminders.

import { notifyChanged, type TableName } from '@/db/changes';
import type { DbClient } from '@/db/client';
import {
  personRepository,
  type NewPerson,
  type PersonPatch,
} from '@/db/repositories/personRepository';
import { markDataChanged } from '@/db/repositories/settingsRepository';
import {
  udhaarRepository,
  type NewUdhaarEntry,
  type UdhaarEntryPatch,
} from '@/db/repositories/udhaarRepository';
import type {
  LocalDate,
  Person,
  PersonWithBalance,
  UdhaarDirection,
  UdhaarEntry,
} from '@/db/types';
import { signedAmount, wouldFlip } from '@/lib/balance';
import type { Clock } from '@/lib/clock';
import { todayLocal } from '@/lib/dates';
import { AppError } from '@/lib/errors';
import type { Paise } from '@/lib/money';

const PEOPLE: readonly TableName[] = ['people', 'app_settings'];
const ENTRIES: readonly TableName[] = ['udhaar_entries', 'people', 'app_settings'];

export interface UdhaarServiceDeps {
  /** Re-plans reminder notifications; the app instance records its own failures. */
  afterChange: (db: DbClient, clock: Clock) => Promise<unknown>;
}

/** FR-4.12: money with a friend is recorded when it actually moves. */
function assertNotFuture(date: LocalDate | undefined, clock: Clock): void {
  if (date !== undefined && date > todayLocal(clock.now())) {
    throw new AppError('VALIDATION', 'Udhaar entries cannot be in the future', {
      detail: 'date.future.udhaar',
    });
  }
}

export function createUdhaarService(deps: UdhaarServiceDeps) {
  async function write<T>(
    db: DbClient,
    clock: Clock,
    tables: readonly TableName[],
    fn: (tx: DbClient, now: Date) => Promise<T>,
  ): Promise<T> {
    const now = clock.now();
    const result = await db.transaction(async (tx) => {
      const value = await fn(tx, now);
      await markDataChanged(tx, now);
      return value;
    });
    notifyChanged(tables);
    await deps.afterChange(db, clock);
    return result;
  }

  /** The person's state after a change, so the screen can offer "remove return date?". */
  const personAfter = (db: DbClient, clock: Clock, personId: string) =>
    personRepository.getWithBalance(db, personId, todayLocal(clock.now()));

  return {
    createPerson: (db: DbClient, clock: Clock, input: NewPerson): Promise<Person> =>
      write(db, clock, PEOPLE, (tx, now) => personRepository.create(tx, input, now)),

    updatePerson: (db: DbClient, clock: Clock, id: string, patch: NewPerson): Promise<Person> =>
      write(db, clock, PEOPLE, (tx, now) => personRepository.update(tx, id, patch, now)),

    /** UDH-07: a new return-by date must be today or later; null clears it (FR-4.11). */
    async setReturnByDate(
      db: DbClient,
      clock: Clock,
      id: string,
      date: LocalDate | null,
    ): Promise<Person> {
      if (date !== null && date < todayLocal(clock.now())) {
        throw new AppError('VALIDATION', 'Return-by date is in the past', {
          detail: 'RETURN_BY_PAST',
        });
      }
      const patch: PersonPatch = { returnByDate: date };
      return write(db, clock, PEOPLE, (tx, now) => personRepository.update(tx, id, patch, now));
    },

    setArchived: (db: DbClient, clock: Clock, id: string, archived: boolean): Promise<Person> =>
      write(db, clock, PEOPLE, (tx, now) => personRepository.setArchived(tx, id, archived, now)),

    deletePerson: (db: DbClient, clock: Clock, id: string): Promise<void> =>
      write(db, clock, PEOPLE, (tx) => personRepository.delete(tx, id)),

    async addEntry(
      db: DbClient,
      clock: Clock,
      input: NewUdhaarEntry,
    ): Promise<{ entry: UdhaarEntry; person: PersonWithBalance | null }> {
      assertNotFuture(input.entryDate, clock);
      const entry = await write(db, clock, ENTRIES, (tx, now) =>
        udhaarRepository.create(tx, input, now),
      );
      return { entry, person: await personAfter(db, clock, input.personId) };
    },

    async updateEntry(
      db: DbClient,
      clock: Clock,
      id: string,
      patch: UdhaarEntryPatch,
    ): Promise<{ entry: UdhaarEntry; person: PersonWithBalance | null }> {
      assertNotFuture(patch.entryDate, clock);
      const entry = await write(db, clock, ENTRIES, (tx, now) =>
        udhaarRepository.update(tx, id, patch, now),
      );
      return { entry, person: await personAfter(db, clock, entry.personId) };
    },

    async deleteEntry(
      db: DbClient,
      clock: Clock,
      id: string,
    ): Promise<{ entry: UdhaarEntry; person: PersonWithBalance | null }> {
      const entry = await write(db, clock, ENTRIES, (tx) => udhaarRepository.delete(tx, id));
      return { entry, person: await personAfter(db, clock, entry.personId) };
    },

    /** FR-4.6 live preview and flip warning; `editingId` leaves the edited entry out. */
    async previewBalanceAfter(
      db: DbClient,
      personId: string,
      draft: { direction: UdhaarDirection; amountPaise: Paise },
      editingId?: string,
    ): Promise<{ before: Paise; after: Paise; flips: boolean }> {
      const before = await udhaarRepository.balanceOf(db, personId, editingId);
      return { before, after: before + signedAmount(draft), flips: wouldFlip(before, draft) };
    },
  };
}

export type UdhaarService = ReturnType<typeof createUdhaarService>;
