// FIN-B01…B04 (pure). B05–B08 are in src/services/reports.repo.test.ts.

import { budgetProgress } from '@/lib/budget';

const R = (rupees: number) => Math.round(rupees * 100);

test('FIN-B01: 7,999 of 10,000 → normal, 79%', () => {
  expect(budgetProgress(R(7_999), R(10_000))).toEqual({
    percent: 79,
    remainingPaise: R(2_001),
    state: 'normal',
  });
});

test('FIN-B02: 8,000 → warning, 80%', () => {
  expect(budgetProgress(R(8_000), R(10_000))).toMatchObject({ percent: 80, state: 'warning' });
});

test('FIN-B03: 10,000 → warning, 100%, remaining 0', () => {
  expect(budgetProgress(R(10_000), R(10_000))).toEqual({
    percent: 100,
    remainingPaise: 0,
    state: 'warning',
  });
});

test('FIN-B04: 10,000.01 → over by ₹0.01', () => {
  expect(budgetProgress(R(10_000.01), R(10_000))).toMatchObject({
    state: 'over',
    remainingPaise: -1,
  });
});

test('just under 80% stays normal (no float rounding)', () => {
  expect(budgetProgress(799_999, 1_000_000).state).toBe('normal');
  expect(budgetProgress(800_000, 1_000_000).state).toBe('warning');
});

test('a zero budget is rejected', () => {
  expect(() => budgetProgress(0, 0)).toThrow();
});
