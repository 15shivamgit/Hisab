import { createContext, useContext, type ReactNode } from 'react';

import type { DbClient } from '@/db/client';

const DatabaseContext = createContext<DbClient | null>(null);

export function DatabaseProvider({ db, children }: { db: DbClient; children: ReactNode }) {
  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
}

export function useDb(): DbClient {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error('useDb must be used inside <DatabaseProvider>');
  return db;
}
