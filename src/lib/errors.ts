// App-wide error type. Spec: docs/02-architecture/ARCHITECTURE.md § Error model.
// `message` is for developers; `detail` is a stable machine-readable reason.
// Neither may contain amounts, names, or notes (they can end up in diagnostics).

export type AppErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONSTRAINT'
  | 'IN_USE'
  | 'FILE_MISSING'
  | 'STORAGE_FULL'
  | 'PERMISSION_DENIED'
  | 'UNSUPPORTED_FILE'
  | 'BACKUP_INVALID'
  | 'DB_NEWER'
  | 'UNKNOWN';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly detail: string | undefined;
  readonly originalError: unknown;

  constructor(
    code: AppErrorCode,
    message: string,
    options: { detail?: string; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.detail = options.detail;
    this.originalError = options.cause;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/** Wraps anything thrown into an AppError; AppErrors pass through unchanged. */
export function toAppError(value: unknown): AppError {
  if (isAppError(value)) return value;
  return new AppError('UNKNOWN', 'Unexpected error', { cause: value });
}
