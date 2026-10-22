// Form values ↔ NewTransaction. Error messages are keys into strings.errors (UI_COPY.md).

import { z } from 'zod';

import type { NewTransaction } from '@/db/repositories/transactionRepository';
import { PAYMENT_METHODS, TXN_TYPES, type PaymentMethod, type TxnType } from '@/db/types';
import { isValidLocalDate, type LocalDate } from '@/lib/dates';
import { paiseToInputText, parseRupeesToPaise } from '@/lib/money';

export interface TransactionFormValues {
  type: TxnType;
  /** As typed, e.g. "1,250.50". */
  amountText: string;
  categoryId: string;
  txnDate: LocalDate;
  paymentMethod: PaymentMethod;
  description: string;
  notes: string;
}

export const transactionFormSchema = z
  .object({
    type: z.enum(TXN_TYPES as [TxnType, ...TxnType[]]),
    amountText: z.string(),
    categoryId: z.string().min(1, 'category.required'),
    txnDate: z.string().refine(isValidLocalDate, 'date.invalid'),
    paymentMethod: z.enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]]),
    description: z.string().max(100, 'description.max'),
    notes: z.string().max(1000, 'notes.max'),
  })
  .superRefine((values, ctx) => {
    const amount = parseRupeesToPaise(values.amountText);
    if (!amount.ok) ctx.addIssue({ code: 'custom', path: ['amountText'], message: amount.error });
  });

/** Call only with values that passed the schema. */
export function toNewTransaction(values: TransactionFormValues): NewTransaction {
  const amount = parseRupeesToPaise(values.amountText);
  if (!amount.ok) throw new Error('toNewTransaction called with an invalid amount');
  return {
    type: values.type,
    amountPaise: amount.value,
    categoryId: values.categoryId,
    txnDate: values.txnDate,
    paymentMethod: values.paymentMethod,
    description: values.description,
    notes: values.notes,
  };
}

export function toFormValues(t: NewTransaction): TransactionFormValues {
  return {
    type: t.type,
    amountText: paiseToInputText(t.amountPaise),
    categoryId: t.categoryId,
    txnDate: t.txnDate,
    paymentMethod: t.paymentMethod,
    description: t.description ?? '',
    notes: t.notes ?? '',
  };
}

export function emptyFormValues(
  type: TxnType,
  today: LocalDate,
  paymentMethod: PaymentMethod = 'cash',
): TransactionFormValues {
  return {
    type,
    amountText: '',
    categoryId: '',
    txnDate: today,
    paymentMethod,
    description: '',
    notes: '',
  };
}
