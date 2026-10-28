// Reports tab data (REPORTS_AND_EXPORT.md § Reports tab, RPT-01…03, FIN-R*). Totals count
// only dates up to today (FR-3.1); future-dated entries appear as "Upcoming". Udhaar is
// never included (it lives in other tables).

import type { DbClient } from '@/db/client';
import { transactionRepository } from '@/db/repositories/transactionRepository';
import type { DateRange, LocalDate, Paise, TxnType } from '@/db/types';
import {
  addDays,
  daysInRange,
  monthRange,
  shiftPeriod,
  weekRange,
  type WeekStart,
} from '@/lib/dates';

export type PeriodKind = 'week' | 'month' | 'custom';

export interface CategorySlice {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  totalPaise: Paise;
  count: number;
  /** Whole percent of the type's total, rounded down. */
  percent: number;
}

export interface TrendBar {
  start: LocalDate;
  end: LocalDate;
  incomePaise: Paise;
  expensePaise: Paise;
}

export interface Report {
  range: DateRange;
  incomePaise: Paise;
  expensePaise: Paise;
  netPaise: Paise;
  /** Expense ÷ days elapsed in the period up to today (0 for a future period). */
  avgSpendPerDayPaise: Paise;
  categories: Record<TxnType, CategorySlice[]>;
  trend: { unit: 'day' | 'week'; bars: TrendBar[] };
  upcoming: { count: number; incomePaise: Paise; expensePaise: Paise };
  /** Nothing up to today and nothing upcoming: "No entries in this period." */
  isEmpty: boolean;
}

/** Daily bars up to 31 days; weekly bars for longer custom ranges. */
export const MAX_DAILY_BARS = 31;

/** The week or month containing `date`. */
export function periodFor(
  kind: 'week' | 'month',
  date: LocalDate,
  weekStart: WeekStart,
): DateRange {
  return kind === 'week' ? weekRange(date, weekStart) : monthRange(date);
}

/** ◀ ▶ navigation; null when moving forward would pass the current period. */
export function stepPeriod(
  range: DateRange,
  kind: 'week' | 'month',
  delta: -1 | 1,
  today: LocalDate,
): DateRange | null {
  const next = shiftPeriod(range, kind, delta);
  return next.start > today ? null : next;
}

function slices(
  rows: Awaited<ReturnType<typeof transactionRepository.sumByCategory>>,
  total: Paise,
): CategorySlice[] {
  return rows.map((r) => ({
    ...r,
    percent: total > 0 ? Math.floor((r.totalPaise * 100) / total) : 0,
  }));
}

function buildTrend(
  range: DateRange,
  daily: { date: LocalDate; incomePaise: Paise; expensePaise: Paise }[],
  weekStart: WeekStart,
): Report['trend'] {
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const days = daysInRange(range);
  if (days <= MAX_DAILY_BARS) {
    const bars: TrendBar[] = [];
    for (let i = 0; i < days; i++) {
      const date = addDays(range.start, i);
      const d = byDate.get(date);
      bars.push({
        start: date,
        end: date,
        incomePaise: d?.incomePaise ?? 0,
        expensePaise: d?.expensePaise ?? 0,
      });
    }
    return { unit: 'day', bars };
  }
  const bars: TrendBar[] = [];
  let start = range.start;
  while (start <= range.end) {
    const weekEnd = weekRange(start, weekStart).end;
    const end = weekEnd < range.end ? weekEnd : range.end;
    let incomePaise = 0;
    let expensePaise = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      incomePaise += byDate.get(d)?.incomePaise ?? 0;
      expensePaise += byDate.get(d)?.expensePaise ?? 0;
    }
    bars.push({ start, end, incomePaise, expensePaise });
    start = addDays(end, 1);
  }
  return { unit: 'week', bars };
}

export const reportService = {
  async getReport(
    db: DbClient,
    range: DateRange,
    today: LocalDate,
    weekStart: WeekStart,
  ): Promise<Report> {
    const [totals, expense, income, daily, upcoming] = await Promise.all([
      transactionRepository.sumByType(db, range, today),
      transactionRepository.sumByCategory(db, range, 'expense', today),
      transactionRepository.sumByCategory(db, range, 'income', today),
      transactionRepository.dailyTotals(db, range, today),
      transactionRepository.upcomingInRange(db, range, today),
    ]);
    const elapsedEnd = range.end < today ? range.end : today;
    const elapsedDays =
      range.start > today ? 0 : daysInRange({ start: range.start, end: elapsedEnd });
    return {
      range,
      incomePaise: totals.incomePaise,
      expensePaise: totals.expensePaise,
      netPaise: totals.incomePaise - totals.expensePaise,
      avgSpendPerDayPaise: elapsedDays > 0 ? Math.floor(totals.expensePaise / elapsedDays) : 0,
      categories: {
        expense: slices(expense, totals.expensePaise),
        income: slices(income, totals.incomePaise),
      },
      trend: buildTrend(range, daily, weekStart),
      upcoming,
      isEmpty: expense.length === 0 && income.length === 0 && upcoming.count === 0,
    };
  },
};
