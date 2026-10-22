// Turns known SQLite failures into AppErrors. Both drivers put the SQLite text in the
// error message (expo-sqlite wraps it), so matching on the text works for both.

import { AppError } from '@/lib/errors';

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Known trigger names raised with RAISE(ABORT, …) in the schema. */
const TRIGGER_ERRORS: Record<string, { code: AppError['code']; message: string }> = {
  CATEGORY_TYPE_MISMATCH: {
    code: 'VALIDATION',
    message: 'Category type does not match transaction type',
  },
  BUDGET_CATEGORY_NOT_EXPENSE: {
    code: 'VALIDATION',
    message: 'Budgets are only for expense categories',
  },
  CATEGORY_IN_USE: { code: 'IN_USE', message: 'Category is in use' },
};

/**
 * Returns an AppError for a recognised SQLite constraint/trigger failure, or the
 * original error unchanged.
 */
export function mapSqliteError(error: unknown, uniqueDetail = 'UNIQUE'): unknown {
  const message = messageOf(error);
  for (const [detail, mapped] of Object.entries(TRIGGER_ERRORS)) {
    if (message.includes(detail)) {
      return new AppError(mapped.code, mapped.message, { detail, cause: error });
    }
  }
  if (message.includes('UNIQUE constraint failed')) {
    return new AppError('CONSTRAINT', 'Duplicate value', { detail: uniqueDetail, cause: error });
  }
  if (message.includes('FOREIGN KEY constraint failed')) {
    return new AppError('CONSTRAINT', 'Referenced row missing or still in use', {
      detail: 'FOREIGN_KEY',
      cause: error,
    });
  }
  if (message.includes('CHECK constraint failed')) {
    return new AppError('VALIDATION', 'Value rejected by the database', {
      detail: 'CHECK',
      cause: error,
    });
  }
  return error;
}
