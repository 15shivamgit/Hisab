import { formatAmountInput, paiseToInputText, parseRupeesToPaise } from '@/lib/money';

describe('formatAmountInput (live grouping while typing)', () => {
  test.each([
    ['', ''],
    ['4', '4'],
    ['4500', '4,500'],
    ['100000', '1,00,000'],
    ['1,00,0000', '10,00,000'],
    ['1000.5', '1,000.5'],
    ['.5', '.5'],
    ['5.', '5.'],
    ['1.2.3', '1.23'],
    ['00012', '12'],
    ['abc', ''],
    ['₹450', '450'],
  ])('%p → %p', (input, output) => expect(formatAmountInput(input)).toBe(output));

  test('formatted text still parses to the same paise', () => {
    for (const typed of ['100000.5', '123456789', '4500.75']) {
      const plain = parseRupeesToPaise(typed);
      const grouped = parseRupeesToPaise(formatAmountInput(typed));
      expect(grouped).toEqual(plain);
    }
  });
});

describe('paiseToInputText (editing an existing amount)', () => {
  test.each([
    [45000, '450'],
    [4550, '45.50'],
    [5, '0.05'],
    [10000000, '1,00,000'],
  ])('%d → %p', (paise, text) => expect(paiseToInputText(paise)).toBe(text));

  test('round-trips through the parser', () => {
    for (const paise of [1, 99, 100, 123456, 1_000_000_000]) {
      expect(parseRupeesToPaise(paiseToInputText(paise))).toEqual({ ok: true, value: paise });
    }
  });
});
