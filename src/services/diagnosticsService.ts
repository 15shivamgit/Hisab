// Local error log + a shareable report (ARCHITECTURE.md § Diagnostics, SET-09).
// Stores only error codes and where they happened — never messages, amounts,
// names, phone numbers, or notes.

import type { DbClient } from '@/db/client';
import { LATEST_SCHEMA_VERSION } from '@/db/migrations';
import { backupRepository } from '@/db/repositories/backupRepository';
import type { IsoDateTime } from '@/lib/dates';
import type { Clock } from '@/lib/clock';
import { toAppError, type AppErrorCode } from '@/lib/errors';
import type { TextFileStore } from '@/platform/files';

export const ERROR_LOG_PATH = 'diagnostics/errors.json';
export const MAX_LOG_ENTRIES = 50;

export interface ErrorLogEntry {
  at: IsoDateTime;
  code: AppErrorCode;
  detail?: string;
  where: string;
  appVersion: string;
}

export interface ReportInfo {
  appVersion: string;
  versionCode: string;
  androidVersion: string;
  device: string;
  schemaVersion?: number;
  counts?: Record<string, number>;
}

function isEntry(value: unknown): value is ErrorLogEntry {
  const v = value as Partial<ErrorLogEntry> | null;
  return typeof v?.at === 'string' && typeof v.code === 'string' && typeof v.where === 'string';
}

export function createDiagnosticsService(deps: {
  files: TextFileStore;
  clock: Clock;
  appVersion: string;
}) {
  async function entries(): Promise<ErrorLogEntry[]> {
    try {
      const raw = await deps.files.read(ERROR_LOG_PATH);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
    } catch {
      return [];
    }
  }

  return {
    entries,

    /** Never throws: logging must not create a second failure. */
    async record(error: unknown, where: string): Promise<void> {
      try {
        const appError = toAppError(error);
        const entry: ErrorLogEntry = {
          at: deps.clock.now().toISOString(),
          code: appError.code,
          ...(appError.detail ? { detail: appError.detail } : {}),
          where,
          appVersion: deps.appVersion,
        };
        const next = [...(await entries()), entry].slice(-MAX_LOG_ENTRIES);
        await deps.files.write(ERROR_LOG_PATH, JSON.stringify(next));
      } catch {
        // Nothing sensible to do; the app keeps working.
      }
    },

    /** Plain text a friend can paste into WhatsApp for the owner. */
    async buildReport(info: ReportInfo): Promise<string> {
      const log = await entries();
      const lines = [
        'Hisaab diagnostic report',
        `App: ${info.appVersion} (${info.versionCode})`,
        `Android: ${info.androidVersion}`,
        `Device: ${info.device}`,
        `Created: ${deps.clock.now().toISOString()}`,
      ];
      if (info.schemaVersion !== undefined) lines.push(`DB schema: v${info.schemaVersion}`);
      if (info.counts) {
        lines.push(
          `Rows: ${Object.entries(info.counts)
            .map(([table, n]) => `${table}=${n}`)
            .join(', ')}`,
        );
      }
      lines.push(`Recent errors (${log.length}):`);
      for (const e of log.slice(-MAX_LOG_ENTRIES).reverse()) {
        lines.push(`- ${e.at} ${e.code}${e.detail ? `/${e.detail}` : ''} @ ${e.where}`);
      }
      return lines.join('\n');
    },
  };
}

export type DiagnosticsService = ReturnType<typeof createDiagnosticsService>;

/** Schema version and row counts for the report: numbers only, never row contents. */
export async function databaseFacts(
  db: DbClient,
): Promise<Required<Pick<ReportInfo, 'schemaVersion' | 'counts'>>> {
  return { schemaVersion: LATEST_SCHEMA_VERSION, counts: await backupRepository.counts(db) };
}
