// The only way code talks to SQLite (ADR-002). Two drivers: expo-sqlite on the phone,
// better-sqlite3 in Jest. Both go through `createDbClient`, so transactions behave the
// same in tests and on the device.

export type SqlParam = string | number | null;

export interface DbClient {
  run(sql: string, params?: readonly SqlParam[]): Promise<{ changes: number }>;
  get<T>(sql: string, params?: readonly SqlParam[]): Promise<T | null>;
  all<T>(sql: string, params?: readonly SqlParam[]): Promise<T[]>;
  /** Several statements, no parameters. Schema and PRAGMAs only. */
  exec(sql: string): Promise<void>;
  /**
   * Runs `fn` in one transaction: commit on success, rollback on any error.
   * Inside `fn`, use only the `tx` client — the outer client waits until the
   * transaction ends, so using it there would never finish.
   * Nested calls on `tx` join the outer transaction.
   */
  transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T>;
}

/** Minimal operations each SQLite library must provide. */
export interface SqlDriver {
  run(sql: string, params: readonly SqlParam[]): Promise<{ changes: number }>;
  get<T>(sql: string, params: readonly SqlParam[]): Promise<T | null>;
  all<T>(sql: string, params: readonly SqlParam[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
}

/**
 * Wraps a single-connection driver. Every operation and every transaction runs one at
 * a time (a promise queue), so no query can slip into the middle of a transaction.
 *
 * Why not expo-sqlite's `withExclusiveTransactionAsync`: it opens a new connection per
 * transaction and runs BEGIN before our code, so `PRAGMA foreign_keys = ON` cannot be
 * applied there and FK rules (RESTRICT/CASCADE) would silently not run.
 */
export function createDbClient(driver: SqlDriver): DbClient {
  let tail: Promise<unknown> = Promise.resolve();

  function serialize<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task, task);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  const txClient: DbClient = {
    run: (sql, params = []) => driver.run(sql, params),
    get: (sql, params = []) => driver.get(sql, params),
    all: (sql, params = []) => driver.all(sql, params),
    exec: (sql) => driver.exec(sql),
    transaction: (fn) => fn(txClient),
  };

  return {
    run: (sql, params = []) => serialize(() => driver.run(sql, params)),
    get: (sql, params = []) => serialize(() => driver.get(sql, params)),
    all: (sql, params = []) => serialize(() => driver.all(sql, params)),
    exec: (sql) => serialize(() => driver.exec(sql)),
    transaction: (fn) =>
      serialize(async () => {
        await driver.exec('BEGIN IMMEDIATE');
        try {
          const result = await fn(txClient);
          await driver.exec('COMMIT');
          return result;
        } catch (error) {
          try {
            await driver.exec('ROLLBACK');
          } catch {
            // The original error matters more than a failed rollback.
          }
          throw error;
        }
      }),
  };
}
