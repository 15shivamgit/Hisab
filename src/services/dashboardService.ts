// Dashboard data in one call (DASHBOARD.md). Phase 4: this-month totals, recent
// transactions, spending by category. Phase 7: udhaar card. Budgets join in Phase 8.

import type { DbClient } from '@/db/client';
import { personRepository } from '@/db/repositories/personRepository';
import { transactionRepository } from '@/db/repositories/transactionRepository';
import { udhaarRepository } from '@/db/repositories/udhaarRepository';
import type {
  DateRange,
  LocalDate,
  Paise,
  PersonWithBalance,
  TransactionListItem,
  UdhaarTotals,
} from '@/db/types';
import { monthRange } from '@/lib/dates';

export interface CategorySpend {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  totalPaise: Paise;
  /** Whole percent of this month's expense, rounded down (FR-1.7). */
  percent: number;
}

export interface DashboardSummary {
  month: DateRange;
  incomePaise: Paise;
  expensePaise: Paise;
  /** income − expense; can be negative. Never called "balance" (FR-3.3). */
  netPaise: Paise;
  recent: TransactionListItem[];
  topCategories: CategorySpend[];
  /** False on first run → show the welcome card. */
  hasAnyTransactions: boolean;
  /** DASH-05/06. null until the user has at least one person (card hidden). */
  udhaar: { totals: UdhaarTotals; attention: PersonWithBalance[] } | null;
}

export const ATTENTION_COUNT = 3;

/** Overdue first (longest overdue first), then due soon (soonest first). */
function needsAttention(people: readonly PersonWithBalance[]): PersonWithBalance[] {
  const byDate = (a: PersonWithBalance, b: PersonWithBalance) =>
    (a.returnByDate ?? '').localeCompare(b.returnByDate ?? '');
  return [
    ...people.filter((p) => p.isOverdue).sort(byDate),
    ...people.filter((p) => p.isDueSoon).sort(byDate),
  ].slice(0, ATTENTION_COUNT);
}

export const RECENT_COUNT = 5;
export const TOP_CATEGORY_COUNT = 5;

export const dashboardService = {
  async getSummary(db: DbClient, today: LocalDate): Promise<DashboardSummary> {
    const month = monthRange(today);
    const { incomePaise, expensePaise } = await transactionRepository.sumByType(db, month, today);
    // Recent = not future-dated (DASHBOARD.md § 8).
    const recent = await transactionRepository.list(
      db,
      { range: { start: '0000-01-01', end: today }, sort: 'date_desc' },
      { limit: RECENT_COUNT, offset: 0 },
    );
    const byCategory = await transactionRepository.sumByCategory(db, month, 'expense', today);
    const { count } = await transactionRepository.summary(db, {}, today);
    const udhaar =
      (await personRepository.count(db)) > 0
        ? {
            totals: await udhaarRepository.totals(db),
            attention: needsAttention(await personRepository.listWithBalances(db, {}, today)),
          }
        : null;
    return {
      month,
      incomePaise,
      expensePaise,
      netPaise: incomePaise - expensePaise,
      recent,
      topCategories: byCategory.slice(0, TOP_CATEGORY_COUNT).map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        categoryIcon: c.categoryIcon,
        categoryColor: c.categoryColor,
        totalPaise: c.totalPaise,
        percent: expensePaise > 0 ? Math.floor((c.totalPaise * 100) / expensePaise) : 0,
      })),
      hasAnyTransactions: count > 0,
      udhaar,
    };
  },
};
