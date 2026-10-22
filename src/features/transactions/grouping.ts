// Turns a transaction page into list rows with day headers (TRANSACTIONS.md § List).

import type { LocalDate, Paise, TransactionListItem, TxnSort } from '@/db/types';

export type ListEntry =
  | { kind: 'header'; key: string; date: LocalDate | 'upcoming'; netPaise: Paise }
  | { kind: 'row'; key: string; item: TransactionListItem; upcoming: boolean };

/**
 * Date sorts: a header per day with that day's net, and future-dated rows together under
 * "Upcoming". Amount sorts: no headers (a day header would be meaningless).
 * The net only counts loaded rows, so it can grow while more pages load.
 */
export function groupTransactions(
  items: readonly TransactionListItem[],
  today: LocalDate,
  sort: TxnSort,
): ListEntry[] {
  const rows = items.map((item): ListEntry => ({
    kind: 'row',
    key: item.id,
    item,
    upcoming: item.txnDate > today,
  }));
  if (sort === 'amount_desc' || sort === 'amount_asc') return rows;

  const groups = new Map<string, TransactionListItem[]>();
  for (const item of items) {
    const key = item.txnDate > today ? 'upcoming' : item.txnDate;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  // Upcoming always sits at the top so planned entries are easy to see (stable sort keeps
  // the other days in the order the query returned them).
  const order = [...groups.keys()].sort((a, b) =>
    a === 'upcoming' ? -1 : b === 'upcoming' ? 1 : 0,
  );

  const result: ListEntry[] = [];
  for (const key of order) {
    const group = groups.get(key) ?? [];
    const netPaise = group.reduce(
      (sum, t) => sum + (t.type === 'income' ? t.amountPaise : -t.amountPaise),
      0,
    );
    result.push({ kind: 'header', key: `h:${key}`, date: key as LocalDate | 'upcoming', netPaise });
    for (const item of group) {
      result.push({ kind: 'row', key: item.id, item, upcoming: key === 'upcoming' });
    }
  }
  return result;
}
