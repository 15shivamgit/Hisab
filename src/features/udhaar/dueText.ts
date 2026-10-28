// Return-by wording (UDHAAR.md § Udhaar tab, § Person ledger; DASHBOARD.md § 5).

import { strings } from '@/content/strings';
import type { PersonWithBalance } from '@/db/types';
import { daysInRange, formatLocalDate, type LocalDate } from '@/lib/dates';

export type DueTone = 'danger' | 'warning' | 'muted';

/** People list badge: "Overdue" or "Due 25 Oct"; null when settled or no date. */
export function listBadge(p: PersonWithBalance): { text: string; tone: DueTone } | null {
  if (p.isOverdue) return { text: strings.udhaar.overdue, tone: 'danger' };
  if (!p.returnByDate || p.balancePaise === 0) return null;
  return {
    text: `Due ${formatLocalDate(p.returnByDate, 'short')}`,
    tone: p.isDueSoon ? 'warning' : 'muted',
  };
}

/** Dashboard rows: "Overdue", "Due today", "Due in 3 days". */
export function dashboardBadge(p: PersonWithBalance, today: LocalDate): string | null {
  if (p.isOverdue) return strings.udhaar.overdue;
  if (!p.isDueSoon || !p.returnByDate) return null;
  const days = daysInRange({ start: today, end: p.returnByDate }) - 1;
  return days === 0 ? strings.udhaar.dueToday : strings.udhaar.dueIn(days);
}

/** Ledger chip: "Return by 25 Oct" / "Overdue since 20 Oct" / "Set return date". */
export function returnByChip(p: PersonWithBalance): string {
  if (!p.returnByDate) return strings.udhaar.setReturnDate;
  const date = formatLocalDate(p.returnByDate, 'short');
  return p.isOverdue ? strings.udhaar.overdueSince(date) : strings.udhaar.returnBy(date);
}

/** Initials for the avatar: "Rahul Kumar" → "RK", "amit" → "A". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((p) => p!.charAt(0).toUpperCase()).join('');
}
