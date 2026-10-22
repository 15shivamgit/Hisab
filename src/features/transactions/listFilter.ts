// What the user picked in the filter sheet, and how it becomes a repository TxnFilter.

import type { DateRange, PaymentMethod, TxnFilter, TxnSort, TxnType } from '@/db/types';
import { monthRange, shiftPeriod, type LocalDate } from '@/lib/dates';

export type ListPeriod = 'all' | 'this_month' | 'last_month' | 'custom';

export interface ListFilter {
  type?: TxnType;
  categoryIds: string[];
  paymentMethods: PaymentMethod[];
  period: ListPeriod;
  custom?: DateRange;
}

export const EMPTY_FILTER: ListFilter = { categoryIds: [], paymentMethods: [], period: 'all' };

export function periodRange(filter: ListFilter, today: LocalDate): DateRange | undefined {
  switch (filter.period) {
    case 'this_month':
      return monthRange(today);
    case 'last_month':
      return shiftPeriod(monthRange(today), 'month', -1);
    case 'custom':
      return filter.custom;
    default:
      return undefined;
  }
}

export function toTxnFilter(
  filter: ListFilter,
  today: LocalDate,
  search: string,
  sort: TxnSort,
): TxnFilter {
  return {
    type: filter.type,
    categoryIds: filter.categoryIds.length ? filter.categoryIds : undefined,
    paymentMethods: filter.paymentMethods.length ? filter.paymentMethods : undefined,
    range: periodRange(filter, today),
    search: search.trim() || undefined,
    sort,
  };
}

export function activeFilterCount(filter: ListFilter): number {
  return (
    (filter.type ? 1 : 0) +
    filter.categoryIds.length +
    filter.paymentMethods.length +
    (filter.period !== 'all' ? 1 : 0)
  );
}
