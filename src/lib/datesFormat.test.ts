// Time formatting and invalid-date guards (Phase 10 coverage review). Jest runs in
// Asia/Kolkata (src/test/globalSetup.js).
import { addDays, daysInMonth, formatDateTime, formatLocalDate, formatTime12 } from '@/lib/dates';

describe('formatTime12', () => {
  test.each([
    ['2026-10-21T00:05:00+05:30', '12:05 AM'],
    ['2026-10-21T09:40:00+05:30', '9:40 AM'],
    ['2026-10-21T12:00:00+05:30', '12:00 PM'],
    ['2026-10-21T21:40:00+05:30', '9:40 PM'],
  ])('%s → %s', (iso, expected) => {
    expect(formatTime12(new Date(iso))).toBe(expected);
  });
});

test('formatDateTime shows the local date and time of an audit timestamp', () => {
  // 16:10 UTC is 21:40 in India, still 21 Oct.
  expect(formatDateTime('2026-10-21T16:10:00.000Z')).toBe('21 Oct 2026, 9:40 PM');
  // 19:00 UTC is 00:30 the next day in India.
  expect(formatDateTime('2026-10-21T19:00:00.000Z')).toBe('22 Oct 2026, 12:30 AM');
});

test('date maths rejects an invalid local date instead of rolling it over', () => {
  expect(() => addDays('2026-02-30', 1)).toThrow(
    expect.objectContaining({ code: 'VALIDATION', detail: 'INVALID_DATE' }),
  );
});

test('daysInMonth gives 0 for a month outside 1–12 (so validation fails)', () => {
  expect(daysInMonth(2028, 2)).toBe(29);
  expect(daysInMonth(2026, 13)).toBe(0);
});

test('formatLocalDate short style, and list style without a "today" to compare with', () => {
  expect(formatLocalDate('2026-10-21', 'short')).toBe('21 Oct');
  expect(formatLocalDate('2026-10-21', 'list')).toBe('Wed, 21 Oct');
});
