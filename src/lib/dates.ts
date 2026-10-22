// Date helpers. Business dates are local calendar dates as 'YYYY-MM-DD' strings;
// audit timestamps are UTC ISO strings. Rules: FINANCIAL_RULES.md §2. Tests: FIN-D*.
//
// Calendar arithmetic is done on day numbers built with Date.UTC, so it never depends
// on the device timezone. Only `todayLocal` reads local time.

import { AppError } from '@/lib/errors';

/** Local calendar date, 'YYYY-MM-DD'. */
export type LocalDate = string;
/** UTC ISO 8601 timestamp, e.g. '2026-10-21T08:15:30.123Z'. */
export type IsoDateTime = string;

export type WeekStart = 'monday' | 'sunday';

export interface DateRange {
  /** Inclusive. */
  start: LocalDate;
  /** Inclusive. */
  end: LocalDate;
}

const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad2 = (n: number) => String(n).padStart(2, '0');

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

/** Real calendar check, not just the shape (FR-2.7). */
export function isValidLocalDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function parts(date: LocalDate): { year: number; month: number; day: number } {
  if (!isValidLocalDate(date)) {
    throw new AppError('VALIDATION', 'Invalid local date', { detail: 'INVALID_DATE' });
  }
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

function fromParts(year: number, month: number, day: number): LocalDate {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

function toDayNumber(date: LocalDate): number {
  const { year, month, day } = parts(date);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function fromDayNumber(dayNumber: number): LocalDate {
  const d = new Date(dayNumber * DAY_MS);
  return fromParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** The device's local calendar date (FR-2.3). */
export function todayLocal(now: Date): LocalDate {
  return fromParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function toIsoDateTime(now: Date): IsoDateTime {
  return now.toISOString();
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: LocalDate): number {
  const { year, month, day } = parts(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Inclusive number of days from start to end (same day → 1). */
export function daysInRange(range: DateRange): number {
  return toDayNumber(range.end) - toDayNumber(range.start) + 1;
}

/** First to last day of the month containing `date` (FR-2.4). */
export function monthRange(date: LocalDate): DateRange {
  const { year, month } = parts(date);
  return {
    start: fromParts(year, month, 1),
    end: fromParts(year, month, daysInMonth(year, month)),
  };
}

/** Seven days starting on the configured week-start day (FR-2.5). */
export function weekRange(date: LocalDate, weekStart: WeekStart): DateRange {
  const dow = dayOfWeek(date);
  const offset = weekStart === 'monday' ? (dow + 6) % 7 : dow;
  const start = addDays(date, -offset);
  return { start, end: addDays(start, 6) };
}

/** Moves a week or month range by `delta` periods. Month shifts never overflow (31 Mar − 1 → Feb). */
export function shiftPeriod(range: DateRange, kind: 'week' | 'month', delta: number): DateRange {
  if (kind === 'week') {
    return { start: addDays(range.start, 7 * delta), end: addDays(range.end, 7 * delta) };
  }
  const { year, month } = parts(range.start);
  const index = year * 12 + (month - 1) + delta;
  return monthRange(fromParts(Math.floor(index / 12), (index % 12) + 1, 1));
}

/** Validated custom range: both real dates and start ≤ end (FR-2.6). */
export function makeRange(start: string, end: string): DateRange {
  if (!isValidLocalDate(start) || !isValidLocalDate(end)) {
    throw new AppError('VALIDATION', 'Invalid date in range', { detail: 'INVALID_DATE' });
  }
  if (start > end) {
    throw new AppError('VALIDATION', 'Range start is after end', { detail: 'RANGE_ORDER' });
  }
  return { start, end };
}

/**
 * Caps the end of a range at today so future-dated entries are not counted (FR-3.1, FR-3.2).
 * Returns null when the whole range is in the future.
 */
export function clampEndToToday(range: DateRange, today: LocalDate): DateRange | null {
  if (range.start > today) return null;
  return { start: range.start, end: range.end < today ? range.end : today };
}

export function isFuture(date: LocalDate, today: LocalDate): boolean {
  return date > today;
}

/**
 * - 'long': "21 Oct 2026"
 * - 'short': "21 Oct"
 * - 'list': "Today", "Yesterday", or "Mon, 19 Oct" (needs `today`)
 */
export function formatLocalDate(
  date: LocalDate,
  style: 'long' | 'short' | 'list',
  today?: LocalDate,
): string {
  const { year, month, day } = parts(date);
  const monthName = MONTHS[month - 1];
  if (style === 'long') return `${day} ${monthName} ${year}`;
  if (style === 'short') return `${day} ${monthName}`;
  if (today !== undefined) {
    if (date === today) return 'Today';
    if (date === addDays(today, -1)) return 'Yesterday';
  }
  return `${WEEKDAYS[dayOfWeek(date)]}, ${day} ${monthName}`;
}

/** "October 2026" — dashboard header. */
export function formatMonthYear(date: LocalDate): string {
  const { year, month } = parts(date);
  return `${MONTHS_LONG[month - 1]} ${year}`;
}
