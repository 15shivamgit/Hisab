// Monthly budgets (BUDGETS.md, BUD-01…04; FINANCIAL_RULES.md §5). Spent = this month's
// expenses up to today (future-dated don't count, FR-3.2); udhaar is never included.

import { notifyChanged } from '@/db/changes';
import type { DbClient } from '@/db/client';
import { budgetRepository } from '@/db/repositories/budgetRepository';
import { categoryRepository } from '@/db/repositories/categoryRepository';
import { markDataChanged } from '@/db/repositories/settingsRepository';
import { transactionRepository } from '@/db/repositories/transactionRepository';
import type { Budget, Category, DateRange, LocalDate, Paise } from '@/db/types';
import { budgetProgress, type BudgetProgress } from '@/lib/budget';
import type { Clock } from '@/lib/clock';
import { monthRange } from '@/lib/dates';

export interface BudgetLine {
  budget: Budget;
  /** null = overall. */
  category: Category | null;
  spentPaise: Paise;
  progress: BudgetProgress;
}

export interface BudgetOverview {
  month: DateRange;
  overall: BudgetLine | null;
  /** In category order. */
  categories: BudgetLine[];
  /** Active expense categories without a budget ("+ Add category budget"). */
  available: Category[];
  /** Category budgets add up to more than the overall budget (hint). */
  categoriesExceedOverall: boolean;
}

const CHANGED = ['budgets', 'app_settings'] as const;

export const budgetService = {
  async getOverview(db: DbClient, today: LocalDate): Promise<BudgetOverview> {
    const month = monthRange(today);
    const [budgets, categories, totals, byCategory] = await Promise.all([
      budgetRepository.list(db),
      categoryRepository.list(db, { type: 'expense', includeArchived: true }),
      transactionRepository.sumByType(db, month, today),
      transactionRepository.sumByCategory(db, month, 'expense', today),
    ]);
    const spentBy = new Map(byCategory.map((c) => [c.categoryId, c.totalPaise]));
    const line = (budget: Budget, category: Category | null, spentPaise: Paise): BudgetLine => ({
      budget,
      category,
      spentPaise,
      progress: budgetProgress(spentPaise, budget.amountPaise),
    });

    const overallBudget = budgets.find((b) => b.categoryId === null);
    const overall = overallBudget ? line(overallBudget, null, totals.expensePaise) : null;
    const byId = new Map(categories.map((c) => [c.id, c]));
    const categoryLines = budgets
      .filter((b) => b.categoryId !== null)
      .map((b) => {
        const category = byId.get(b.categoryId as string) ?? null;
        return line(b, category, spentBy.get(b.categoryId as string) ?? 0);
      })
      .sort((a, b) => (a.category?.sortOrder ?? 0) - (b.category?.sortOrder ?? 0));
    const withBudget = new Set(categoryLines.map((l) => l.budget.categoryId));
    const categoryTotal = categoryLines.reduce((sum, l) => sum + l.budget.amountPaise, 0);

    return {
      month,
      overall,
      categories: categoryLines,
      available: categories.filter((c) => c.archivedAt === null && !withBudget.has(c.id)),
      categoriesExceedOverall: overall !== null && categoryTotal > overall.budget.amountPaise,
    };
  },

  /** DASH-04: overall + up to 3 category budgets with the highest percentage. */
  async dashboardCard(
    db: DbClient,
    today: LocalDate,
  ): Promise<{ overall: BudgetLine | null; top: BudgetLine[] } | null> {
    const o = await budgetService.getOverview(db, today);
    if (!o.overall && o.categories.length === 0) return null;
    const top = [...o.categories]
      .sort((a, b) => b.progress.percent - a.progress.percent)
      .slice(0, 3);
    return { overall: o.overall, top };
  },

  async setOverall(db: DbClient, clock: Clock, amountPaise: Paise): Promise<Budget> {
    return write(db, clock, (tx, now) => budgetRepository.upsertOverall(tx, amountPaise, now));
  },

  async setForCategory(
    db: DbClient,
    clock: Clock,
    categoryId: string,
    amountPaise: Paise,
  ): Promise<Budget> {
    return write(db, clock, (tx, now) =>
      budgetRepository.upsertForCategory(tx, categoryId, amountPaise, now),
    );
  },

  async remove(db: DbClient, clock: Clock, budgetId: string): Promise<void> {
    await write(db, clock, (tx) => budgetRepository.delete(tx, budgetId));
  },
};

async function write<T>(
  db: DbClient,
  clock: Clock,
  fn: (tx: DbClient, now: Date) => Promise<T>,
): Promise<T> {
  const now = clock.now();
  const result = await db.transaction(async (tx) => {
    const value = await fn(tx, now);
    await markDataChanged(tx, now);
    return value;
  });
  notifyChanged(CHANGED);
  return result;
}
