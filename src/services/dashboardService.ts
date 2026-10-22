// Dashboard data in one call (DASHBOARD.md). Phase 4: this-month totals, recent
// transactions, spending by category. Udhaar, budgets, and the backup nudge join later.

import type { DbClient } from '@/db/client';
import { transactionRepository } from '@/db/repositories/transactionRepository';
import type { DateRange, LocalDate, Paise, TransactionListItem } from '@/db/types';
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
    };
  },
};
