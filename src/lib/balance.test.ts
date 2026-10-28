// FIN-U cases from docs/10-testing/FINANCIAL_TEST_CASES.md (pure parts; the repository
// cases U07, U08, U10, U11, U14–U16 are in src/services/udhaar.repo.test.ts).

import type { UdhaarDirection } from '@/db/types';
import {
  balanceLabel,
  balanceOf,
  isDueSoon,
  isOverdue,
  runningBalances,
  udhaarTotals,
  wouldFlip,
} from '@/lib/balance';

const e = (direction: UdhaarDirection, rupees: number) => ({
  direction,
  amountPaise: rupees * 100,
});

test('FIN-U01: gave 10,000, got 3,000 → you will get 7,000', () => {
  const b = balanceOf([e('gave', 10_000), e('got', 3_000)]);
  expect(b).toBe(700_000);
  expect(balanceLabel(b)).toBe('will_get');
});

test('FIN-U02: got 8,000, gave 2,000 → you owe 6,000', () => {
  const b = balanceOf([e('got', 8_000), e('gave', 2_000)]);
  expect(b).toBe(-600_000);
  expect(balanceLabel(b)).toBe('owe');
});

test('FIN-U03: partial returns → running 10,000 / 7,000 / 5,000 / 0, settled', () => {
  const entries = [e('gave', 10_000), e('got', 3_000), e('got', 2_000), e('got', 5_000)];
  expect(runningBalances(entries)).toEqual([1_000_000, 700_000, 500_000, 0]);
  expect(balanceLabel(balanceOf(entries))).toBe('settled');
});

test('FIN-U04: top-up', () => {
  expect(balanceOf([e('gave', 5_000), e('gave', 2_000), e('got', 1_000)])).toBe(600_000);
});

test('FIN-U05 / U06: flip warning only when the side changes', () => {
  expect(wouldFlip(700_000, e('got', 8_000))).toBe(true);
  expect(wouldFlip(700_000, e('got', 7_000))).toBe(false);
  expect(wouldFlip(0, e('got', 500))).toBe(false);
  expect(wouldFlip(-600_000, e('gave', 7_000))).toBe(true);
  expect(wouldFlip(700_000, e('gave', 1_000))).toBe(false);
});

test('FIN-U09: totals are not netted', () => {
  expect(udhaarTotals([700_000, -600_000, 0, 50_000])).toEqual({
    youWillGetPaise: 750_000,
    willGetCount: 2,
    youOwePaise: 600_000,
    oweCount: 1,
  });
});

test('FIN-U12: overdue needs a past date and an open balance', () => {
  expect(isOverdue('2026-10-20', 700_000, '2026-10-21')).toBe(true);
  expect(isOverdue('2026-10-20', 0, '2026-10-21')).toBe(false);
  expect(isOverdue('2026-10-21', 700_000, '2026-10-21')).toBe(false);
  expect(isOverdue(null, 700_000, '2026-10-21')).toBe(false);
});

test('FIN-U13: due soon = today … today + 7 days', () => {
  expect(isDueSoon('2026-10-28', 700_000, '2026-10-21')).toBe(true);
  expect(isDueSoon('2026-10-29', 700_000, '2026-10-21')).toBe(false);
  expect(isDueSoon('2026-10-21', -500, '2026-10-21')).toBe(true);
  expect(isDueSoon('2026-10-25', 0, '2026-10-21')).toBe(false);
});
