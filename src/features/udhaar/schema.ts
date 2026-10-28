// Entry form values ↔ NewUdhaarEntry. Error messages are keys into strings.errors.

import { z } from 'zod';

import type { NewUdhaarEntry } from '@/db/repositories/udhaarRepository';
import {
  PAYMENT_METHODS,
  UDHAAR_DIRECTIONS,
  type PaymentMethod,
  type UdhaarDirection,
  type UdhaarEntry,
} from '@/db/types';
import { isValidLocalDate, type LocalDate } from '@/lib/dates';
import { paiseToInputText, parseRupeesToPaise } from '@/lib/money';

export interface UdhaarEntryFormValues {
  direction: UdhaarDirection;
  amountText: string;
  entryDate: LocalDate;
  paymentMethod: PaymentMethod;
  note: string;
}

/** `today` is needed for FR-4.12 (no future udhaar). */
export function udhaarEntrySchema(today: LocalDate) {
  return z
    .object({
      direction: z.enum(UDHAAR_DIRECTIONS as [UdhaarDirection, ...UdhaarDirection[]]),
      amountText: z.string(),
      entryDate: z
        .string()
        .refine(isValidLocalDate, 'date.invalid')
        .refine((d) => d <= today, 'date.future.udhaar'),
      paymentMethod: z.enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]]),
      note: z.string().max(500, 'note.max'),
    })
    .superRefine((values, ctx) => {
      const amount = parseRupeesToPaise(values.amountText);
      if (!amount.ok) ctx.addIssue({ code: 'custom', path: ['amountText'], message: amount.error });
    });
}

/** Call only with values that passed the schema. */
export function toNewEntry(personId: string, values: UdhaarEntryFormValues): NewUdhaarEntry {
  const amount = parseRupeesToPaise(values.amountText);
  if (!amount.ok) throw new Error('toNewEntry called with an invalid amount');
  return {
    personId,
    direction: values.direction,
    amountPaise: amount.value,
    entryDate: values.entryDate,
    paymentMethod: values.paymentMethod,
    note: values.note,
  };
}

export function entryToFormValues(e: UdhaarEntry): UdhaarEntryFormValues {
  return {
    direction: e.direction,
    amountText: paiseToInputText(e.amountPaise),
    entryDate: e.entryDate,
    paymentMethod: e.paymentMethod,
    note: e.note ?? '',
  };
}

export function emptyEntryValues(
  direction: UdhaarDirection,
  today: LocalDate,
): UdhaarEntryFormValues {
  return { direction, amountText: '', entryDate: today, paymentMethod: 'cash', note: '' };
}
