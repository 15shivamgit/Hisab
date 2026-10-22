import {
  addDays,
  clampEndToToday,
  daysInRange,
  formatLocalDate,
  formatMonthYear,
  isFuture,
  isValidLocalDate,
  makeRange,
  monthRange,
  shiftPeriod,
  todayLocal,
  weekRange,
} from '@/lib/dates';

test('Jest runs in Asia/Kolkata (globalSetup)', () => {
  // 18:45 UTC is 00:15 IST the next day.
  expect(new Date('2026-10-21T18:45:00Z').getHours()).toBe(0);
});

describe('FIN-D month ranges', () => {
  test('FIN-D01 February 2026 has 28 days', () =>
    expect(monthRange('2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-02-28' }));
  test('FIN-D02 February 2028 has 29 days', () =>
    expect(monthRange('2028-02-10')).toEqual({ start: '2028-02-01', end: '2028-02-29' }));
  test('FIN-D03 2100 is not a leap year', () =>
    expect(monthRange('2100-02-01')).toEqual({ start: '2100-02-01', end: '2100-02-28' }));
  test('FIN-D04 December', () =>
    expect(monthRange('2026-12-31')).toEqual({ start: '2026-12-01', end: '2026-12-31' }));
});

describe('FIN-D week ranges', () => {
  test('FIN-D05 week across the year boundary', () =>
    expect(weekRange('2026-01-01', 'monday')).toEqual({ start: '2025-12-29', end: '2026-01-04' }));
  test('FIN-D06 Sunday with Monday and Sunday week starts', () => {
    expect(weekRange('2026-10-25', 'monday')).toEqual({ start: '2026-10-19', end: '2026-10-25' });
    expect(weekRange('2026-10-25', 'sunday')).toEqual({ start: '2026-10-25', end: '2026-10-31' });
  });
});

test.each([
  ['2026-02-29', false],
  ['2028-02-29', true],
  ['2026-13-01', false],
  ['2026-1-5', false],
  ['2026-04-31', false],
  ['2026-00-10', false],
  ['2026-10-00', false],
  ['2026-10-21', true],
  ['21-10-2026', false],
])('FIN-D07 isValidLocalDate(%p) → %p', (value, expected) =>
  expect(isValidLocalDate(value)).toBe(expected),
);

test('FIN-D08 today is the local (IST) calendar date', () =>
  expect(todayLocal(new Date('2026-10-21T18:45:00Z'))).toBe('2026-10-22'));

test('FIN-D09 previous month from 31 March is all of February', () =>
  expect(shiftPeriod(monthRange('2026-03-31'), 'month', -1)).toEqual({
    start: '2026-02-01',
    end: '2026-02-28',
  }));

test('FIN-D10 custom range with start after end is an error', () => {
  expect(() => makeRange('2026-10-10', '2026-10-01')).toThrow(
    expect.objectContaining({ code: 'VALIDATION', detail: 'RANGE_ORDER' }),
  );
  expect(makeRange('2026-10-01', '2026-10-10')).toEqual({ start: '2026-10-01', end: '2026-10-10' });
  expect(() => makeRange('2026-02-30', '2026-03-01')).toThrow();
});

describe('period shifting', () => {
  test('month shift across a year', () => {
    expect(shiftPeriod(monthRange('2026-12-15'), 'month', 1)).toEqual({
      start: '2027-01-01',
      end: '2027-01-31',
    });
    expect(shiftPeriod(monthRange('2026-01-15'), 'month', -1)).toEqual({
      start: '2025-12-01',
      end: '2025-12-31',
    });
  });
  test('week shift', () =>
    expect(shiftPeriod(weekRange('2026-10-21', 'monday'), 'week', -1)).toEqual({
      start: '2026-10-12',
      end: '2026-10-18',
    }));
});

describe('clampEndToToday', () => {
  test('caps the end at today', () =>
    expect(clampEndToToday(monthRange('2026-10-21'), '2026-10-21')).toEqual({
      start: '2026-10-01',
      end: '2026-10-21',
    }));
  test('past range is unchanged', () =>
    expect(clampEndToToday(monthRange('2026-09-10'), '2026-10-21')).toEqual(
      monthRange('2026-09-10'),
    ));
  test('fully future range is null', () =>
    expect(clampEndToToday(monthRange('2026-11-05'), '2026-10-21')).toBeNull());
});

test('addDays across leap day and year', () => {
  expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
});

test('daysInRange counts both ends', () =>
  expect(daysInRange({ start: '2026-10-01', end: '2026-10-21' })).toBe(21));

test('isFuture compares calendar dates', () => {
  expect(isFuture('2026-10-22', '2026-10-21')).toBe(true);
  expect(isFuture('2026-10-21', '2026-10-21')).toBe(false);
});

describe('formatting', () => {
  test('long and short', () => {
    expect(formatLocalDate('2026-10-21', 'long')).toBe('21 Oct 2026');
    expect(formatLocalDate('2026-10-05', 'short')).toBe('5 Oct');
  });
  test('list style uses Today / Yesterday', () => {
    expect(formatLocalDate('2026-10-21', 'list', '2026-10-21')).toBe('Today');
    expect(formatLocalDate('2026-10-20', 'list', '2026-10-21')).toBe('Yesterday');
    expect(formatLocalDate('2026-10-19', 'list', '2026-10-21')).toBe('Mon, 19 Oct');
  });
  test('month header', () => expect(formatMonthYear('2026-10-21')).toBe('October 2026'));
});
