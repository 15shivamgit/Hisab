// Tiny change feed between services (writers) and useDbQuery (readers).
// ARCHITECTURE.md § Reading and refreshing data.

export type TableName =
  | 'app_settings'
  | 'categories'
  | 'transactions'
  | 'transaction_attachments'
  | 'budgets'
  | 'people'
  | 'udhaar_entries';

export const ALL_TABLES: readonly TableName[] = [
  'app_settings',
  'categories',
  'transactions',
  'transaction_attachments',
  'budgets',
  'people',
  'udhaar_entries',
];

type Listener = (changed: ReadonlySet<TableName>) => void;

const listeners = new Set<Listener>();

export function subscribeToChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Call after a successful commit. */
export function notifyChanged(tables: readonly TableName[] | 'all'): void {
  const changed = new Set(tables === 'all' ? ALL_TABLES : tables);
  for (const listener of [...listeners]) listener(changed);
}
