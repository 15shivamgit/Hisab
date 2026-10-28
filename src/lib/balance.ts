// Udhaar balance maths (FINANCIAL_RULES.md §4). A balance is always derived from the
// entries, never stored: > 0 the friend owes the user, < 0 the user owes the friend.

import type { BalanceLabel, UdhaarDirection, UdhaarTotals } from '@/db/types';
import { addDays, type LocalDate } from '@/lib/dates';
import type { Paise } from '@/lib/money';

export const DUE_SOON_DAYS = 7;

interface EntryAmount {
  direction: UdhaarDirection;
  amountPaise: Paise;
}

/** gave → +amount, got → −amount (FR-4.1, FR-4.2). */
export function signedAmount(entry: EntryAmount): Paise {
  return entry.direction === 'gave' ? entry.amountPaise : -entry.amountPaise;
}

export function balanceOf(entries: readonly EntryAmount[]): Paise {
  return entries.reduce((sum, e) => sum + signedAmount(e), 0);
}

/** Balance after each entry, for entries in date order (oldest first). */
export function runningBalances(entriesAsc: readonly EntryAmount[]): Paise[] {
  let balance = 0;
  return entriesAsc.map((e) => (balance += signedAmount(e)));
}

export function balanceLabel(balance: Paise): BalanceLabel {
  if (balance > 0) return 'will_get';
  if (balance < 0) return 'owe';
  return 'settled';
}

/**
 * FR-4.6: true when the entry moves the balance from one side to the other
 * (e.g. +₹7,000 and the friend returns ₹8,000). Reaching exactly 0 is not a flip.
 */
export function wouldFlip(before: Paise, entry: EntryAmount): boolean {
  const after = before + signedAmount(entry);
  return before !== 0 && after !== 0 && Math.sign(before) !== Math.sign(after);
}

/** FR-4.10: the return-by date has passed and money is still open. */
export function isOverdue(returnBy: LocalDate | null, balance: Paise, today: LocalDate): boolean {
  return returnBy !== null && balance !== 0 && returnBy < today;
}

/** FR-4.10: due today or within the next 7 days, and money is still open. */
export function isDueSoon(returnBy: LocalDate | null, balance: Paise, today: LocalDate): boolean {
  return (
    returnBy !== null &&
    balance !== 0 &&
    returnBy >= today &&
    returnBy <= addDays(today, DUE_SOON_DAYS)
  );
}

/** FR-4.9: positive and negative balances are summed separately, never netted. */
export function udhaarTotals(balances: readonly Paise[]): UdhaarTotals {
  const totals: UdhaarTotals = { youWillGetPaise: 0, willGetCount: 0, youOwePaise: 0, oweCount: 0 };
  for (const b of balances) {
    if (b > 0) {
      totals.youWillGetPaise += b;
      totals.willGetCount++;
    } else if (b < 0) {
      totals.youOwePaise += -b;
      totals.oweCount++;
    }
  }
  return totals;
}
