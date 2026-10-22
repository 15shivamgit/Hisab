// Read + auto-refresh (ARCHITECTURE.md § Reading and refreshing data, ADR-013).
// Re-runs the query when `deps` change or when a service calls notifyChanged()
// for one of the listed tables.

import { useEffect, useState, type DependencyList } from 'react';

import type { DbClient } from '@/db/client';
import { subscribeToChanges, type TableName } from '@/db/changes';
import { toAppError, type AppError } from '@/lib/errors';
import { useDb } from '@/hooks/DatabaseContext';

export type DbQueryState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: AppError };

export function useDbQuery<T>(
  query: (db: DbClient) => Promise<T>,
  deps: DependencyList,
  options: { tables: readonly TableName[] },
): DbQueryState<T> & { reload: () => void } {
  'use no memo'; // Dynamic dependency list; React Compiler should leave this hook alone.
  const db = useDb();
  const [state, setState] = useState<DbQueryState<T>>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const tablesKey = options.tables.join(',');

  useEffect(() => {
    const tables = new Set(tablesKey.split(',') as TableName[]);
    return subscribeToChanges((changed) => {
      for (const table of changed) {
        if (tables.has(table)) {
          setVersion((v) => v + 1);
          return;
        }
      }
    });
  }, [tablesKey]);

  useEffect(() => {
    let current = true;
    query(db).then(
      (data) => current && setState({ status: 'success', data }),
      (error: unknown) => current && setState({ status: 'error', error: toAppError(error) }),
    );
    return () => {
      current = false;
    };
    // `query` is usually an inline function; `deps` says when it really changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version, ...deps]);

  return { ...state, reload: () => setVersion((v) => v + 1) };
}
