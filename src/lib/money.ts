// Money helpers — the only place that converts between text and paise.
// Rules: docs/01-requirements/FINANCIAL_RULES.md §1. Tests: FIN-M* cases.

import { AppError } from '@/lib/errors';

/** Integer number of paise (₹1 = 100 paise). */
export type Paise = number;

export const MIN_PAISE = 1;
/** ₹1,00,00,000 (1 crore) per entry (FR-1.4). */
export const MAX_PAISE = 1_000_000_000;

export type AmountErrorCode =
  'amount.required' | 'amount.zero' | 'amount.decimals' | 'amount.max' | 'amount.invalid';

export type ParseAmountResult = { ok: true; value: Paise } | { ok: false; error: AmountErrorCode };

// Integer part: plain digits, or comma-grouped (Indian "1,00,000" or international "100,000").
// Fraction: any number of digits here; more than 2 is reported as amount.decimals.
const AMOUNT_RE = /^(\d+|\d{1,3}(?:,\d{2,3})+)?(?:\.(\d*))?$/;

/**
 * Parses what the user typed into paise (FR-1.5). Works on strings only — never
 * `parseFloat(x) * 100`, which gives float errors.
 */
export function parseRupeesToPaise(text: string): ParseAmountResult {
  const input = text.trim();
  if (input === '') return { ok: false, error: 'amount.required' };

  const match = AMOUNT_RE.exec(input);
  const intPart = match?.[1];
  const fracPart = match?.[2];
  if (!match || (intPart === undefined && !fracPart)) {
    return { ok: false, error: 'amount.invalid' };
  }

  const fraction = fracPart ?? '';
  if (fraction.length > 2) return { ok: false, error: 'amount.decimals' };

  const rupeeDigits = (intPart ?? '0').replace(/,/g, '').replace(/^0+(?=\d)/, '');
  // More than 8 digits of rupees is above ₹1 crore; checking length first keeps the
  // arithmetic well inside safe-integer range.
  if (rupeeDigits.length > 8) return { ok: false, error: 'amount.max' };

  const value = Number(rupeeDigits) * 100 + Number(fraction.padEnd(2, '0'));
  if (value === 0) return { ok: false, error: 'amount.zero' };
  if (value > MAX_PAISE) return { ok: false, error: 'amount.max' };
  return { ok: true, value };
}

const MINUS = '−';

/** Indian digit grouping of a digit string: "1234567" → "12,34,567". */
export function groupIndianDigits(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

export interface FormatPaiseOptions {
  /** Hide ".00" for whole rupees (compact views). */
  compact?: boolean;
  /** Prefix "+" for positive values. Negative values always get "−". */
  sign?: boolean;
}

/** Formats paise for display: 12500050 → "₹1,25,000.50" (FR-1.6). Accepts negatives. */
export function formatPaise(paise: Paise, options: FormatPaiseOptions = {}): string {
  if (!Number.isInteger(paise)) {
    throw new AppError('VALIDATION', 'formatPaise expects integer paise', {
      detail: 'NOT_INTEGER',
    });
  }
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const fraction = abs % 100;
  const prefix = paise < 0 ? MINUS : options.sign && paise > 0 ? '+' : '';
  const decimals = options.compact && fraction === 0 ? '' : `.${String(fraction).padStart(2, '0')}`;
  return `${prefix}₹${groupIndianDigits(String(rupees))}${decimals}`;
}

/**
 * Live formatting for the amount field: keeps digits and one dot, groups the rupee
 * part Indian-style ("100000.5" → "1,00,000.5"). Extra dots are dropped from the
 * new text, so a second "." cannot be typed. Validation still happens in
 * parseRupeesToPaise.
 */
export function formatAmountInput(text: string): string {
  const cleaned = text.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  const intPart = dot === -1 ? cleaned : cleaned.slice(0, dot);
  const fraction = dot === -1 ? '' : `.${cleaned.slice(dot + 1).replace(/\./g, '')}`;
  const digits = intPart.replace(/^0+(?=\d)/, '');
  return `${digits ? groupIndianDigits(digits) : ''}${fraction}`;
}

/** Text for editing an existing amount: 4550 → "45.50", 45000 → "450". */
export function paiseToInputText(paise: Paise): string {
  const rupees = groupIndianDigits(String(Math.floor(paise / 100)));
  const fraction = paise % 100;
  return fraction === 0 ? rupees : `${rupees}.${String(fraction).padStart(2, '0')}`;
}

/** Plain decimal rupees for CSV: 123450 → "1234.50" (no ₹, no grouping, ASCII minus). */
export function paiseToRupeeString(paise: Paise): string {
  if (!Number.isInteger(paise)) {
    throw new AppError('VALIDATION', 'paiseToRupeeString expects integer paise', {
      detail: 'NOT_INTEGER',
    });
  }
  const abs = Math.abs(paise);
  const text = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return paise < 0 ? `-${text}` : text;
}

/** Guards a stored amount: integer, ₹0.01 … ₹1 crore (FR-1.2–1.4). */
export function assertPaise(value: number): asserts value is Paise {
  if (!Number.isInteger(value) || value < MIN_PAISE || value > MAX_PAISE) {
    throw new AppError('VALIDATION', 'Amount out of range', { detail: 'AMOUNT_RANGE' });
  }
}
