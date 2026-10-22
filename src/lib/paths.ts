// Receipt file paths. The DB stores only 'receipts/<uuid>.jpg'; every path is checked
// against this pattern before touching the file system (SECURITY_AND_PRIVACY.md).

import { AppError } from '@/lib/errors';
import { isUuid } from '@/lib/ids';

const SAFE_RECEIPT_RE = /^receipts\/[0-9a-f-]{36}\.jpg$/;

export function receiptRelativePath(attachmentId: string): string {
  if (!isUuid(attachmentId)) {
    throw new AppError('VALIDATION', 'Attachment id is not a UUID', { detail: 'BAD_ID' });
  }
  return `receipts/${attachmentId}.jpg`;
}

export function isSafeReceiptPath(value: string): boolean {
  return SAFE_RECEIPT_RE.test(value);
}

/** Joins a safe relative path onto the app's document directory URI. */
export function toAbsolute(relativePath: string, documentDirUri: string): string {
  if (!isSafeReceiptPath(relativePath)) {
    throw new AppError('VALIDATION', 'Unsafe receipt path', { detail: 'UNSAFE_PATH' });
  }
  return `${documentDirUri.replace(/\/+$/, '')}/${relativePath}`;
}
