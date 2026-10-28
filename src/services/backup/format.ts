// The .hisaab backup format, formatVersion 1 (BACKUP_AND_RESTORE.md § File format).
// Every row in data.json is checked here before restore touches anything (BAK-03).

import { z } from 'zod';

import { isValidLocalDate } from '@/lib/dates';
import { isUuid } from '@/lib/ids';
import { MAX_PAISE, MIN_PAISE } from '@/lib/money';
import { isSafeReceiptPath } from '@/lib/paths';
import { normalizePhone } from '@/lib/phone';

export const BACKUP_FORMAT = 'hisaab-backup';
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_EXTENSION = '.hisaab';
export const MANIFEST_NAME = 'manifest.json';
export const DATA_NAME = 'data.json';

/** Restore limits (BACKUP_AND_RESTORE.md § Pick and stage). */
export const RESTORE_LIMITS = {
  archiveBytes: 2 * 1024 ** 3,
  receiptEntries: 5000,
  receiptBytes: 10 * 1024 ** 2,
  dataBytes: 50 * 1024 ** 2,
  manifestBytes: 5 * 1024 ** 2,
  totalUncompressedBytes: 2.5 * 1024 ** 3,
} as const;

/** The only names allowed inside a backup (zip-slip protection). */
export function isAllowedEntryName(name: string): boolean {
  return name === MANIFEST_NAME || name === DATA_NAME || isSafeReceiptPath(name);
}

const uuid = z.string().refine(isUuid);
const isoDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/)
  .refine((s) => !Number.isNaN(Date.parse(s)));
const localDate = z.string().refine(isValidLocalDate);
const paise = z.number().int().min(MIN_PAISE).max(MAX_PAISE);
const txnType = z.enum(['income', 'expense']);
const bit = z.union([z.literal(0), z.literal(1)]);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const count = z.number().int().min(0);

export const manifestSchema = z.strictObject({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.number().int().min(1),
  schemaVersion: z.number().int().min(1),
  appVersion: z.string().max(50),
  createdAt: isoDateTime,
  counts: z.strictObject({
    categories: count,
    transactions: count,
    attachments: count,
    budgets: count,
    people: count.optional(),
    udhaarEntries: count.optional(),
  }),
  files: z.array(
    z.strictObject({
      path: z.string().refine(isSafeReceiptPath),
      sizeBytes: z.number().int().min(1),
      sha256,
    }),
  ),
  missingFiles: z.array(z.string().refine(isSafeReceiptPath)),
  dataSha256: sha256,
});

export type BackupManifest = z.infer<typeof manifestSchema>;

/** Just enough to say "not a backup" or "made by a newer version" before full checks. */
export const manifestHeaderSchema = z.object({
  format: z.string(),
  formatVersion: z.number(),
  schemaVersion: z.number(),
});

const categoryRow = z.strictObject({
  id: uuid,
  name: z.string().refine((s) => s.trim().length >= 1 && s.trim().length <= 30),
  type: txnType,
  icon: z.string().regex(/^[a-z0-9_]{1,60}$/),
  color: z.string().regex(/^cat\.[a-z]{1,20}$/),
  is_system: bit,
  sort_order: z.number().int(),
  archived_at: isoDateTime.nullable(),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});

const transactionRow = z.strictObject({
  id: uuid,
  type: txnType,
  amount_paise: paise,
  category_id: uuid,
  txn_date: localDate,
  payment_method: z.enum(['cash', 'upi', 'bank_transfer', 'card', 'other']),
  description: z.string().max(100).nullable(),
  notes: z.string().max(1000).nullable(),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});

const attachmentRow = z.strictObject({
  id: uuid,
  transaction_id: uuid,
  relative_path: z.string().refine(isSafeReceiptPath),
  mime_type: z.literal('image/jpeg'),
  size_bytes: z.number().int().min(1),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  sort_order: z.number().int(),
  created_at: isoDateTime,
});

const personRow = z.strictObject({
  id: uuid,
  name: z.string().refine((s) => s.trim().length >= 1 && s.trim().length <= 60),
  phone: z
    .string()
    .refine((s) => normalizePhone(s) === s)
    .nullable(),
  notes: z.string().max(500).nullable(),
  return_by_date: localDate.nullable(),
  archived_at: isoDateTime.nullable(),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});

const udhaarEntryRow = z.strictObject({
  id: uuid,
  person_id: uuid,
  direction: z.enum(['gave', 'got']),
  amount_paise: paise,
  entry_date: localDate,
  payment_method: z.enum(['cash', 'upi', 'bank_transfer', 'card', 'other']),
  note: z.string().max(500).nullable(),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});

const budgetRow = z.strictObject({
  id: uuid,
  category_id: uuid.nullable(),
  amount_paise: paise,
  created_at: isoDateTime,
  updated_at: isoDateTime,
});

const portableSettings = z.strictObject({
  theme: z.enum(['system', 'light', 'dark']),
  week_start: z.enum(['monday', 'sunday']),
  reminders_enabled: z.boolean(),
  reminder_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

/** data.json at the current schema (after `upgradeData`). */
export const dataSchema = z.strictObject({
  settings: portableSettings,
  categories: z.array(categoryRow),
  transactions: z.array(transactionRow),
  transactionAttachments: z.array(attachmentRow),
  budgets: z.array(budgetRow),
  people: z.array(personRow),
  udhaarEntries: z.array(udhaarEntryRow),
});

export type BackupFileData = z.infer<typeof dataSchema>;

/** hisaab-backup-2026-10-21-2140.hisaab (local time). */
export function backupFileName(now: Date, prefix = 'hisaab-backup'): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  return `${prefix}-${date}-${p(now.getHours())}${p(now.getMinutes())}${BACKUP_EXTENSION}`;
}
