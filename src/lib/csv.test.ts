import { csvNumber, toCsv } from '@/lib/csv';

test('UTF-8 BOM, comma separator, CRLF line endings', () => {
  expect(toCsv(['a', 'b'], [['1', 2]])).toBe('﻿a,b\r\n1,2\r\n');
});

test('RFC 4180 quoting for commas, quotes, and new lines', () => {
  const csv = toCsv(['text'], [['Tea, snacks'], ['He said "hi"'], ['two\nlines'], [null]]);
  expect(csv.split('\r\n').slice(1, 5)).toEqual([
    '"Tea, snacks"',
    '"He said ""hi"""',
    '"two\nlines"',
    '',
  ]);
});

test('formula-injection guard on text cells', () => {
  const csv = toCsv(['t'], [['=SUM(A1)'], ['+91 98'], ['-5'], ['@me'], ['\tx'], ['safe=yes']]);
  expect(csv.split('\r\n').slice(1, 7)).toEqual([
    "'=SUM(A1)",
    "'+91 98",
    "'-5",
    "'@me",
    "'\tx",
    'safe=yes',
  ]);
});

test('₹ and Hindi text pass through unchanged', () => {
  expect(toCsv(['n'], [['चाय ₹20']])).toContain('चाय ₹20');
});

test('pre-formatted numbers pass through (negative balances stay numbers)', () => {
  expect(toCsv(['a', 'b'], [[csvNumber('-600.00'), csvNumber('1234.50')]])).toBe(
    '﻿a,b\r\n-600.00,1234.50\r\n',
  );
  expect(() => toCsv(['a'], [[csvNumber('=1+1')]])).toThrow();
});
