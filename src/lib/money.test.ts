import {
  assertPaise,
  formatPaise,
  MAX_PAISE,
  paiseToRupeeString,
  parseRupeesToPaise,
  type ParseAmountResult,
} from '@/lib/money';

const ok = (value: number): ParseAmountResult => ({ ok: true, value });
const err = (error: string) => ({ ok: false, error });

describe('parseRupeesToPaise', () => {
  test('FIN-M01 "450" → 45000', () => expect(parseRupeesToPaise('450')).toEqual(ok(45000)));
  test('FIN-M02 "1,00,000.5" → 10000050', () =>
    expect(parseRupeesToPaise('1,00,000.5')).toEqual(ok(10000050)));
  test('FIN-M03 ".5" → 50', () => expect(parseRupeesToPaise('.5')).toEqual(ok(50)));
  test('FIN-M04 " 450 " is trimmed', () => expect(parseRupeesToPaise(' 450 ')).toEqual(ok(45000)));
  test('FIN-M05 "100,000.75" → 10000075 (international commas)', () =>
    expect(parseRupeesToPaise('100,000.75')).toEqual(ok(10000075)));
  test('FIN-M06 zero is rejected', () => {
    expect(parseRupeesToPaise('0')).toEqual(err('amount.zero'));
    expect(parseRupeesToPaise('0.00')).toEqual(err('amount.zero'));
  });
  test('FIN-M07 negative is invalid', () =>
    expect(parseRupeesToPaise('-10')).toEqual(err('amount.invalid')));
  test('FIN-M08 more than 2 decimals', () =>
    expect(parseRupeesToPaise('1.234')).toEqual(err('amount.decimals')));
  test('FIN-M09 ₹1 crore is the maximum allowed', () =>
    expect(parseRupeesToPaise('10000000')).toEqual(ok(MAX_PAISE)));
  test('FIN-M10 above ₹1 crore', () =>
    expect(parseRupeesToPaise('10000000.01')).toEqual(err('amount.max')));
  test.each(['', '   ', 'abc', '1e3', '1.2.3'])('FIN-M11 %p is an error', (input) =>
    expect(parseRupeesToPaise(input).ok).toBe(false),
  );
  test('FIN-M11 empty input asks for an amount', () => {
    expect(parseRupeesToPaise('')).toEqual(err('amount.required'));
    expect(parseRupeesToPaise('   ')).toEqual(err('amount.required'));
  });
  test('FIN-M12 0.1 + 0.2 is exactly 30 paise', () => {
    const a = parseRupeesToPaise('0.1');
    const b = parseRupeesToPaise('0.2');
    expect(a.ok && b.ok && a.value + b.value).toBe(30);
  });

  test.each([
    ['1,0,000', 'amount.invalid'],
    [',100', 'amount.invalid'],
    ['100,', 'amount.invalid'],
    ['.', 'amount.invalid'],
    ['+5', 'amount.invalid'],
    ['₹450', 'amount.invalid'],
    ['999999999', 'amount.max'],
  ])('rejects %p as %s', (input, error) => expect(parseRupeesToPaise(input)).toEqual(err(error)));

  test.each([
    ['5.', 500],
    ['0.01', 1],
    ['007', 700],
    ['12,34,567.89', 123456789],
  ])('accepts %p → %d', (input, value) => expect(parseRupeesToPaise(input)).toEqual(ok(value)));
});

describe('formatPaise', () => {
  test('FIN-M13 Indian grouping with paise', () =>
    expect(formatPaise(12500050)).toBe('₹1,25,000.50'));
  test('FIN-M14 compact hides .00', () =>
    expect(formatPaise(10000000, { compact: true })).toBe('₹1,00,000'));
  test('FIN-M15 small amounts keep leading zero', () => expect(formatPaise(5)).toBe('₹0.05'));
  test('compact keeps real paise', () =>
    expect(formatPaise(4550, { compact: true })).toBe('₹45.50'));
  test('negative values use a minus sign (cash flow)', () =>
    expect(formatPaise(-200000)).toBe('−₹2,000.00'));
  test('sign option adds + to positives only', () => {
    expect(formatPaise(100, { sign: true })).toBe('+₹1.00');
    expect(formatPaise(0, { sign: true })).toBe('₹0.00');
  });
  test.each([
    [0, '₹0.00'],
    [99999, '₹999.99'],
    [100000, '₹1,000.00'],
    [MAX_PAISE, '₹1,00,00,000.00'],
  ])('%d → %s', (paise, text) => expect(formatPaise(paise)).toBe(text));
  test('rejects non-integers', () => expect(() => formatPaise(1.5)).toThrow());
});

describe('paiseToRupeeString', () => {
  test('FIN-M16 CSV format', () => expect(paiseToRupeeString(123450)).toBe('1234.50'));
  test('small and negative', () => {
    expect(paiseToRupeeString(5)).toBe('0.05');
    expect(paiseToRupeeString(-5)).toBe('-0.05');
  });
});

describe('assertPaise', () => {
  test.each([1, 45000, MAX_PAISE])('accepts %d', (value) =>
    expect(() => assertPaise(value)).not.toThrow(),
  );
  test.each([0, -1, 1.5, MAX_PAISE + 1, Number.NaN])('rejects %p', (value) =>
    expect(() => assertPaise(value)).toThrow(),
  );
});
