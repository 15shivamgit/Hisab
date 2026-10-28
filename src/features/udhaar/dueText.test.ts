import type { PersonWithBalance } from '@/db/types';
import { dashboardBadge, initials, listBadge, returnByChip } from '@/features/udhaar/dueText';
import { balanceLabel, isDueSoon, isOverdue } from '@/lib/balance';

const TODAY = '2026-10-21';

function person(returnByDate: string | null, balancePaise = 700_000): PersonWithBalance {
  return {
    id: 'p',
    name: 'Rahul',
    phone: null,
    notes: null,
    returnByDate,
    archivedAt: null,
    createdAt: 'x',
    updatedAt: 'x',
    balancePaise,
    label: balanceLabel(balancePaise),
    entryCount: 1,
    lastEntryDate: TODAY,
    isOverdue: isOverdue(returnByDate, balancePaise, TODAY),
    isDueSoon: isDueSoon(returnByDate, balancePaise, TODAY),
  };
}

test('list badge: overdue, due soon, later, none', () => {
  expect(listBadge(person('2026-10-20'))).toEqual({ text: 'Overdue', tone: 'danger' });
  expect(listBadge(person('2026-10-25'))).toEqual({ text: 'Due 25 Oct', tone: 'warning' });
  expect(listBadge(person('2026-12-01'))).toEqual({ text: 'Due 1 Dec', tone: 'muted' });
  expect(listBadge(person('2026-10-20', 0))).toBeNull();
  expect(listBadge(person(null))).toBeNull();
});

test('dashboard badge counts days', () => {
  expect(dashboardBadge(person('2026-10-20'), TODAY)).toBe('Overdue');
  expect(dashboardBadge(person(TODAY), TODAY)).toBe('Due today');
  expect(dashboardBadge(person('2026-10-22'), TODAY)).toBe('Due in 1 day');
  expect(dashboardBadge(person('2026-10-24'), TODAY)).toBe('Due in 3 days');
  expect(dashboardBadge(person('2026-12-01'), TODAY)).toBeNull();
});

test('ledger chip and initials', () => {
  expect(returnByChip(person(null))).toBe('Set return date');
  expect(returnByChip(person('2026-10-25'))).toBe('Return by 25 Oct');
  expect(returnByChip(person('2026-10-20'))).toBe('Overdue since 20 Oct');
  expect(initials('Rahul Kumar Singh')).toBe('RS');
  expect(initials('  amit ')).toBe('A');
});
