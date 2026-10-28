// Domain types returned by repositories (camelCase models, never raw rows).
// Spec: docs/04-api/REPOSITORIES.md, docs/03-database/DATABASE_SCHEMA.md.

import type { DateRange, IsoDateTime, LocalDate } from '@/lib/dates';
import type { Paise } from '@/lib/money';

export type { DateRange, IsoDateTime, LocalDate, Paise };

export type TxnType = 'income' | 'expense';
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'card' | 'other';

export const TXN_TYPES: readonly TxnType[] = ['income', 'expense'];
export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'cash',
  'upi',
  'bank_transfer',
  'card',
  'other',
];

export interface Page {
  limit: number;
  offset: number;
}

export interface Category {
  id: string;
  name: string;
  type: TxnType;
  /** Material Symbols name (DEFAULT_CATEGORIES.md). */
  icon: string;
  /** Category colour token, e.g. 'cat.orange'. */
  color: string;
  /** The "Other" category of each type: cannot be deleted, archived, or renamed. */
  isSystem: boolean;
  sortOrder: number;
  archivedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Transaction {
  id: string;
  type: TxnType;
  amountPaise: Paise;
  categoryId: string;
  txnDate: LocalDate;
  paymentMethod: PaymentMethod;
  description: string | null;
  notes: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface TransactionListItem extends Transaction {
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  attachmentCount: number;
}

export interface Attachment {
  id: string;
  transactionId: string;
  /** Always 'receipts/<id>.jpg'. */
  relativePath: string;
  mimeType: 'image/jpeg';
  sizeBytes: number;
  width: number;
  height: number;
  sortOrder: number;
  createdAt: IsoDateTime;
}

export interface TransactionDetail extends TransactionListItem {
  attachments: Attachment[];
}

export interface Budget {
  id: string;
  /** null = the overall monthly budget. */
  categoryId: string | null;
  amountPaise: Paise;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

// ── Udhaar (UDHAAR.md, FINANCIAL_RULES.md §4) ─────────────────────────────────

export type UdhaarDirection = 'gave' | 'got';
export const UDHAAR_DIRECTIONS: readonly UdhaarDirection[] = ['gave', 'got'];

/** > 0 "You will get", < 0 "You owe", 0 "Settled" (FR-4.3). */
export type BalanceLabel = 'will_get' | 'owe' | 'settled';

export interface Person {
  id: string;
  name: string;
  /** Normalised: digits with an optional leading '+'. */
  phone: string | null;
  notes: string | null;
  returnByDate: LocalDate | null;
  archivedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface PersonWithBalance extends Person {
  /** Σ gave − Σ got; always derived (FR-4.2). */
  balancePaise: Paise;
  label: BalanceLabel;
  entryCount: number;
  lastEntryDate: LocalDate | null;
  isOverdue: boolean;
  isDueSoon: boolean;
}

export interface UdhaarEntry {
  id: string;
  personId: string;
  direction: UdhaarDirection;
  amountPaise: Paise;
  entryDate: LocalDate;
  paymentMethod: PaymentMethod;
  note: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface UdhaarEntryWithBalance extends UdhaarEntry {
  /** The person's balance right after this entry. */
  balanceAfterPaise: Paise;
}

export interface UdhaarEntryWithPerson extends UdhaarEntryWithBalance {
  personName: string;
}

export type PeopleFilter = 'all' | 'will_get' | 'owe' | 'settled' | 'overdue';
export type PeopleSort = 'amount_desc' | 'name_asc' | 'recent';

export interface UdhaarTotals {
  youWillGetPaise: Paise;
  willGetCount: number;
  youOwePaise: Paise;
  oweCount: number;
}

export type TxnSort = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

export interface TxnFilter {
  type?: TxnType;
  categoryIds?: readonly string[];
  paymentMethods?: readonly PaymentMethod[];
  range?: DateRange;
  /** Matches description or notes (case-insensitive), or the exact amount when it parses as one. */
  search?: string;
  sort?: TxnSort;
}
