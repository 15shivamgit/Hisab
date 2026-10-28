// CSV for spreadsheets (REPORTS_AND_EXPORT.md § CSV rules): UTF-8 with BOM so Excel shows
// ₹ and Hindi correctly, comma separator, CRLF, RFC 4180 quoting, and a guard against
// formula injection.

/** A number already formatted for spreadsheets, e.g. "-1234.50" (not formula-guarded). */
export interface CsvNumber {
  number: string;
}

export type CsvCell = string | number | null | CsvNumber;

const BOM = '﻿';
// Spec: = + - @. Tab and carriage return are also formula triggers in some spreadsheets.
const FORMULA_START = /^[=+\-@\t\r]/;
const NUMBER = /^-?\d+(\.\d+)?$/;

export const csvNumber = (number: string): CsvNumber => ({ number });

function cell(value: CsvCell): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    if (!NUMBER.test(value.number)) throw new Error('csvNumber expects a plain decimal number');
    return value.number;
  }
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  const line = (cells: readonly CsvCell[]) => cells.map(cell).join(',');
  return `${BOM}${[line(headers), ...rows.map(line)].join('\r\n')}\r\n`;
}
