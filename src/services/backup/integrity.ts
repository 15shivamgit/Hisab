// Cross-row checks on a parsed backup (BACKUP_AND_RESTORE.md § Validate). Returns a
// stable reason code for diagnostics, or null when everything is consistent.

import { MAX_ATTACHMENTS_PER_TRANSACTION } from '@/db/repositories/attachmentRepository';
import type { BackupFileData, BackupManifest } from '@/services/backup/format';

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

export function findIntegrityProblem(
  data: BackupFileData,
  manifest: BackupManifest,
  stagedReceipts: ReadonlySet<string>,
): string | null {
  const categories = new Map(data.categories.map((c) => [c.id, c]));
  const transactions = new Map(data.transactions.map((t) => [t.id, t]));

  if (
    hasDuplicates(data.categories.map((c) => c.id)) ||
    hasDuplicates(data.transactions.map((t) => t.id)) ||
    hasDuplicates(data.transactionAttachments.map((a) => a.id)) ||
    hasDuplicates(data.budgets.map((b) => b.id))
  ) {
    return 'DUPLICATE_ID';
  }
  if (hasDuplicates(data.categories.map((c) => `${c.type}:${c.name.toLowerCase()}`))) {
    return 'DUPLICATE_CATEGORY_NAME';
  }

  for (const t of data.transactions) {
    const category = categories.get(t.category_id);
    if (!category) return 'TRANSACTION_CATEGORY_MISSING';
    if (category.type !== t.type) return 'CATEGORY_TYPE_MISMATCH';
  }

  const perTransaction = new Map<string, number>();
  for (const a of data.transactionAttachments) {
    if (!transactions.has(a.transaction_id)) return 'ATTACHMENT_TRANSACTION_MISSING';
    if (a.relative_path !== `receipts/${a.id}.jpg`) return 'ATTACHMENT_PATH_MISMATCH';
    const n = (perTransaction.get(a.transaction_id) ?? 0) + 1;
    if (n > MAX_ATTACHMENTS_PER_TRANSACTION) return 'TOO_MANY_ATTACHMENTS';
    perTransaction.set(a.transaction_id, n);
  }

  if (
    hasDuplicates(data.people.map((p) => p.id)) ||
    hasDuplicates(data.udhaarEntries.map((e) => e.id))
  ) {
    return 'DUPLICATE_ID';
  }
  const people = new Set(data.people.map((p) => p.id));
  for (const e of data.udhaarEntries) {
    if (!people.has(e.person_id)) return 'UDHAAR_PERSON_MISSING';
  }

  const budgetKeys = data.budgets.map((b) => b.category_id ?? 'overall');
  if (hasDuplicates(budgetKeys)) return 'DUPLICATE_BUDGET';
  for (const b of data.budgets) {
    if (b.category_id === null) continue;
    const category = categories.get(b.category_id);
    if (!category) return 'BUDGET_CATEGORY_MISSING';
    if (category.type !== 'expense') return 'BUDGET_CATEGORY_NOT_EXPENSE';
  }

  // Files: each attachment has a staged file or is declared missing — never both, never neither.
  const filePaths = manifest.files.map((f) => f.path);
  if (hasDuplicates(filePaths) || hasDuplicates(manifest.missingFiles)) return 'DUPLICATE_FILE';
  const missing = new Set(manifest.missingFiles);
  const rowPaths = new Set(data.transactionAttachments.map((a) => a.relative_path));
  for (const path of rowPaths) {
    const staged = stagedReceipts.has(path);
    if (staged === missing.has(path))
      return staged ? 'FILE_BOTH_PRESENT_AND_MISSING' : 'FILE_NOT_IN_BACKUP';
  }
  for (const path of [...missing, ...filePaths, ...stagedReceipts]) {
    if (!rowPaths.has(path)) return 'FILE_WITHOUT_ROW';
  }
  if (filePaths.length !== stagedReceipts.size) return 'FILE_COUNT_MISMATCH';

  const counts = manifest.counts;
  if (
    counts.categories !== data.categories.length ||
    counts.transactions !== data.transactions.length ||
    counts.attachments !== data.transactionAttachments.length ||
    counts.budgets !== data.budgets.length ||
    (counts.people ?? 0) !== data.people.length ||
    (counts.udhaarEntries ?? 0) !== data.udhaarEntries.length
  ) {
    return 'COUNT_MISMATCH';
  }
  return null;
}
