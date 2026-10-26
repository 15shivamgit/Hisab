// Backup, restore, and crash recovery (BACKUP_AND_RESTORE.md, BAK-01…07, ADR-009).
// Files and hashing are injected so the whole flow runs in Jest; the app instance is
// src/services/backup/index.ts.

import { inflateSync, strFromU8, strToU8 } from 'fflate';

import { notifyChanged } from '@/db/changes';
import type { DbClient } from '@/db/client';
import { LATEST_SCHEMA_VERSION } from '@/db/migrations';
import { backupRepository, type BackupData } from '@/db/repositories/backupRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import type { Clock } from '@/lib/clock';
import { toIsoDateTime } from '@/lib/dates';
import { AppError, isAppError } from '@/lib/errors';
import { newId } from '@/lib/ids';
import {
  entryDataOffset,
  readZipDirectory,
  ZipFormatError,
  type ByteSource,
  type ZipEntry,
} from '@/lib/zip/zipReader';
import { createZipWriter } from '@/lib/zip/zipWriter';
import type { BackupFiles } from '@/platform/backupFiles';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  backupFileName,
  dataSchema,
  DATA_NAME,
  isAllowedEntryName,
  MANIFEST_NAME,
  manifestHeaderSchema,
  manifestSchema,
  RESTORE_LIMITS,
  type BackupFileData,
  type BackupManifest,
} from '@/services/backup/format';
import { findIntegrityProblem } from '@/services/backup/integrity';
import { upgradeData } from '@/services/backup/upgrade';

const MB = 1024 * 1024;
const JOURNAL = 'restore-journal.json';
const RECEIPTS = 'receipts';
const INCOMING = 'receipts-incoming';
const OLD = 'receipts-old';
const BACKUPS = 'backups';
const EXPORTS = 'exports';
const STAGING = 'staging';
const SAFETY_PREFIX = 'pre-restore';
/** Rough bytes per row in data.json, for free-space estimates. */
const BYTES_PER_ROW = 400;

export interface BackupCounts {
  categories: number;
  transactions: number;
  attachments: number;
  budgets: number;
}

export interface BackupResult {
  uri: string;
  fileName: string;
  sizeBytes: number;
  counts: BackupCounts;
  /** Receipts whose files were missing; their rows are still in the backup. */
  missingFiles: number;
}

export type RestoreSource = 'file' | 'undo';

/** Everything checked and staged; nothing on the phone has changed yet. */
export interface ValidationReport {
  stagingId: string;
  source: RestoreSource;
  createdAt: string;
  counts: BackupCounts;
  missingFiles: number;
  data: BackupFileData;
}

interface Journal {
  stage: 'db' | 'files';
  stagingId: string;
  createdAt: string;
}

export interface BackupServiceDeps {
  files: BackupFiles;
  sha256: (bytes: Uint8Array) => Promise<string>;
  /** Runs after restore deletes/re-creates receipts, to clear leftovers. */
  sweepOrphans: (db: DbClient, now: Date) => Promise<unknown>;
  appVersion: string;
  /** Debug only: lets a manual test kill the app in the middle of a restore. */
  pauseAt?: (stage: Journal['stage']) => Promise<void>;
}

function invalid(detail: 'NOT_BACKUP' | 'NEWER_VERSION' | 'DAMAGED', reason: string): AppError {
  return new AppError('BACKUP_INVALID', reason, { detail });
}

/** First Zod issue as "path: code" — field names only, never values. */
function zodReason(prefix: string, issues: readonly { path: PropertyKey[]; code: string }[]) {
  const issue = issues[0];
  return `${prefix}.${issue ? issue.path.map(String).join('.') : ''}: ${issue?.code ?? 'invalid'}`;
}

function countsOf(data: BackupFileData | BackupData): BackupCounts {
  return {
    categories: data.categories.length,
    transactions: data.transactions.length,
    attachments: data.transactionAttachments.length,
    budgets: data.budgets.length,
  };
}

async function readEntry(source: ByteSource, entry: ZipEntry, maxBytes: number) {
  if (entry.uncompressedSize > maxBytes) throw invalid('DAMAGED', `${entry.name}: too large`);
  const start = await entryDataOffset(source, entry);
  const raw = await source.read(start, entry.compressedSize);
  if (raw.length !== entry.compressedSize) throw invalid('DAMAGED', `${entry.name}: truncated`);
  if (entry.method === 0) return raw;
  try {
    const out = inflateSync(raw, { out: new Uint8Array(entry.uncompressedSize) });
    if (out.length !== entry.uncompressedSize) throw new Error('size');
    return out;
  } catch {
    throw invalid('DAMAGED', `${entry.name}: cannot decompress`);
  }
}

function parseJson(bytes: Uint8Array, name: string): unknown {
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    throw invalid('DAMAGED', `${name}: not JSON`);
  }
}

export function createBackupService(deps: BackupServiceDeps) {
  const { files, sha256 } = deps;
  const doc = (path: string) => files.documentUri(path);
  const cache = (path: string) => files.cacheUri(path);
  const stagingDir = (id: string) => cache(`${STAGING}/restore-${id}`);

  /** Estimated size of a backup of the current data (step 1). */
  async function estimateBackupBytes(db: DbClient): Promise<number> {
    const counts = await backupRepository.counts(db);
    const rows = Object.values(counts).reduce((a, b) => a + b, 0);
    const row = await db.get<{ total: number | null }>(
      'SELECT SUM(size_bytes) AS total FROM transaction_attachments',
    );
    return rows * BYTES_PER_ROW + (row?.total ?? 0) + MB;
  }

  /** Writes a complete backup of the current data to `targetUri`. */
  async function writeBackup(db: DbClient, now: Date, targetUri: string) {
    const estimate = await estimateBackupBytes(db);
    if (files.freeBytes() < estimate * 1.2) {
      throw new AppError('STORAGE_FULL', 'Not enough space for a backup', { detail: 'BACKUP' });
    }
    // One read transaction = a consistent snapshot of every table.
    const data = await db.transaction((tx) => backupRepository.dumpAll(tx));
    const dataBytes = strToU8(JSON.stringify(data));
    const partial = `${targetUri}.partial`;
    files.remove(partial);

    const fileList: BackupManifest['files'] = [];
    const missing: string[] = [];
    const writer = files.openWrite(partial);
    try {
      const zip = createZipWriter(writer, now);
      await zip.addDeflated(DATA_NAME, dataBytes);
      for (const row of data.transactionAttachments) {
        const path = String(row.relative_path);
        const uri = doc(path);
        if (!files.exists(uri)) {
          missing.push(path);
          continue;
        }
        const bytes = await files.readAll(uri);
        fileList.push({ path, sizeBytes: bytes.length, sha256: await sha256(bytes) });
        await zip.addStored(path, bytes);
      }
      const counts = countsOf(data);
      const manifest: BackupManifest = {
        format: BACKUP_FORMAT,
        formatVersion: BACKUP_FORMAT_VERSION,
        schemaVersion: LATEST_SCHEMA_VERSION,
        appVersion: deps.appVersion,
        createdAt: toIsoDateTime(now),
        counts,
        files: fileList,
        missingFiles: missing,
        dataSha256: await sha256(dataBytes),
      };
      await zip.addDeflated(MANIFEST_NAME, strToU8(JSON.stringify(manifest, null, 2)));
      await zip.finish();
    } finally {
      writer.close();
    }

    // Step 6: re-open the finished file and check the manifest parses.
    await readManifestOrThrow(partial);
    files.remove(targetUri);
    await files.move(partial, targetUri);
    return { counts: countsOf(data), missingFiles: missing.length };
  }

  async function readManifestOrThrow(uri: string): Promise<BackupManifest> {
    const reader = files.openRead(uri);
    try {
      const entries = await readZipDirectory(reader, {
        maxEntries: RESTORE_LIMITS.receiptEntries + 2,
      });
      const entry = entries.find((e) => e.name === MANIFEST_NAME);
      if (!entry) throw new Error('manifest missing');
      return manifestSchema.parse(
        parseJson(await readEntry(reader, entry, RESTORE_LIMITS.manifestBytes), MANIFEST_NAME),
      );
    } finally {
      reader.close();
    }
  }

  const service = {
    estimateBackupBytes,

    /** Steps 1–6: a backup in cache/exports, ready for the share sheet. */
    async create(db: DbClient, clock: Clock): Promise<BackupResult> {
      const now = clock.now();
      files.remove(cache(EXPORTS)); // old exports are cleared on the next export
      const fileName = backupFileName(now);
      const uri = cache(`${EXPORTS}/${fileName}`);
      try {
        const { counts, missingFiles } = await writeBackup(db, now, uri);
        return { uri, fileName, sizeBytes: files.size(uri) ?? 0, counts, missingFiles };
      } catch (error) {
        files.remove(cache(EXPORTS));
        throw error;
      }
    },

    /** Step 7: the share sheet closed (Android can't tell us whether it was saved). */
    async markBackedUp(db: DbClient, clock: Clock): Promise<void> {
      const now = clock.now();
      await db.transaction(async (tx) => {
        await settingsRepository.set(tx, 'last_backup_at', toIsoDateTime(now), now);
        await settingsRepository.set(tx, 'data_changed_since_backup', false, now);
      });
      notifyChanged(['app_settings']);
    },

    /** Restore steps 1–2: copy into staging, check everything, extract receipts. */
    async inspect(db: DbClient, fileUri: string, source: RestoreSource): Promise<ValidationReport> {
      const stagingId = newId();
      const dir = stagingDir(stagingId);
      const zipUri = `${dir}/backup.zip`;
      try {
        const size = files.size(fileUri);
        if (size === null) throw invalid('NOT_BACKUP', 'file not found');
        if (size > RESTORE_LIMITS.archiveBytes) throw invalid('DAMAGED', 'archive too large');
        if (files.freeBytes() < size + 50 * MB) {
          throw new AppError('STORAGE_FULL', 'No space to stage backup', { detail: 'RESTORE' });
        }
        await files.copy(fileUri, zipUri);

        const reader = files.openRead(zipUri);
        let report: ValidationReport;
        try {
          report = await validateAndExtract(db, reader, dir, stagingId, source);
        } finally {
          reader.close();
        }
        files.remove(zipUri);
        return report;
      } catch (error) {
        files.remove(dir);
        if (error instanceof ZipFormatError) {
          const notZip =
            error.reason === 'too small' || error.reason === 'no end of central directory';
          throw invalid(notZip ? 'NOT_BACKUP' : 'DAMAGED', error.reason);
        }
        throw error;
      }
    },

    /** The user cancelled after inspect: remove the staged files. */
    discard(report: ValidationReport): void {
      files.remove(stagingDir(report.stagingId));
    },

    /** Restore steps 4.1–4.6 (BAK-04, BAK-05). */
    async restore(db: DbClient, clock: Clock, report: ValidationReport): Promise<void> {
      const now = clock.now();
      const dir = stagingDir(report.stagingId);

      // 1. Safety backup; if it fails nothing has changed.
      const stamp = toIsoDateTime(now).replace(/[-:.]/g, '').slice(0, 15);
      const safetyUri = doc(`${BACKUPS}/${SAFETY_PREFIX}-${stamp}.hisaab`);
      try {
        await writeBackup(db, now, safetyUri);
      } catch (error) {
        files.remove(safetyUri);
        files.remove(dir);
        throw isAppError(error) && error.code === 'STORAGE_FULL'
          ? error
          : new AppError('UNKNOWN', 'Safety backup failed', {
              detail: 'SAFETY_BACKUP_FAILED',
              cause: error,
            });
      }
      for (const name of files.list(doc(BACKUPS))) {
        if (doc(`${BACKUPS}/${name}`) !== safetyUri) files.remove(doc(`${BACKUPS}/${name}`));
      }

      // 2–3. Staged receipts become receipts-incoming; journal the DB step.
      files.remove(doc(INCOMING));
      files.remove(doc(OLD));
      const staged = `${dir}/${RECEIPTS}`;
      if (files.exists(staged)) await files.move(staged, doc(INCOMING));
      else files.makeDir(doc(INCOMING));
      await writeJournal({
        stage: 'db',
        stagingId: report.stagingId,
        createdAt: toIsoDateTime(now),
      });
      await deps.pauseAt?.('db');

      // 4. One transaction: replace everything, or nothing.
      try {
        await db.transaction(async (tx) => {
          await backupRepository.replaceAll(tx, report.data, now);
          await settingsRepository.set(tx, 'restore_marker', report.stagingId, now);
          // A restored file equals a file outside the app; "undo" data exists only inside it.
          await settingsRepository.set(
            tx,
            'data_changed_since_backup',
            report.source === 'undo',
            now,
          );
          if ((await backupRepository.foreignKeyViolations(tx)) > 0) {
            throw new Error('Foreign key check failed');
          }
        });
      } catch (error) {
        files.remove(doc(INCOMING));
        files.remove(doc(JOURNAL));
        files.remove(dir);
        throw new AppError('UNKNOWN', 'Restore failed', { detail: 'RESTORE_FAILED', cause: error });
      }

      // 5–6. Swap the receipt folders, then clean up.
      await writeJournal({
        stage: 'files',
        stagingId: report.stagingId,
        createdAt: toIsoDateTime(now),
      });
      await deps.pauseAt?.('files');
      await finishFiles(db, now);
    },

    /** Startup step 5: finish or undo a restore that was interrupted. */
    async recoverIfInterrupted(
      db: DbClient,
      clock: Clock,
    ): Promise<'none' | 'finished' | 'rolled-back'> {
      const now = clock.now();
      const journal = await readJournal();
      if (!journal) {
        removeStagedRestores();
        files.remove(doc(INCOMING));
        return 'none';
      }
      const committed =
        journal.stage === 'files' ||
        (await settingsRepository.get(db, 'restore_marker')) === journal.stagingId;
      if (!committed) {
        files.remove(doc(INCOMING));
        files.remove(doc(JOURNAL));
        removeStagedRestores();
        return 'rolled-back';
      }
      await writeJournal({ ...journal, stage: 'files' });
      await finishFiles(db, now);
      return 'finished';
    },

    /** The pre-restore safety backup, if there is one ("Undo last restore"). */
    safetyBackupUri(): string | null {
      const name = files
        .list(doc(BACKUPS))
        .filter((n) => n.startsWith(`${SAFETY_PREFIX}-`) && n.endsWith('.hisaab'))
        .sort()
        .pop();
      return name ? doc(`${BACKUPS}/${name}`) : null;
    },
  };

  async function validateAndExtract(
    db: DbClient,
    reader: ByteSource,
    dir: string,
    stagingId: string,
    source: RestoreSource,
  ): Promise<ValidationReport> {
    const entries = await readZipDirectory(reader, {
      maxEntries: RESTORE_LIMITS.receiptEntries + 2,
    });

    // Strict allowlist: one bad name rejects the whole file (zip-slip protection).
    const names = new Set<string>();
    let total = 0;
    for (const entry of entries) {
      if (!isAllowedEntryName(entry.name) || names.has(entry.name)) {
        throw invalid('DAMAGED', 'unexpected entry name');
      }
      names.add(entry.name);
      total += entry.uncompressedSize;
    }
    const manifestEntry = entries.find((e) => e.name === MANIFEST_NAME);
    const dataEntry = entries.find((e) => e.name === DATA_NAME);
    if (!manifestEntry) throw invalid('NOT_BACKUP', 'no manifest');
    if (!dataEntry) throw invalid('DAMAGED', 'no data');
    const receiptEntries = entries.filter((e) => e !== manifestEntry && e !== dataEntry);
    if (receiptEntries.length > RESTORE_LIMITS.receiptEntries)
      throw invalid('DAMAGED', 'too many receipts');
    if (total > RESTORE_LIMITS.totalUncompressedBytes) throw invalid('DAMAGED', 'too large');

    // During a restore the extracted files, the safety backup, and current data all exist.
    const needed = (total + (await estimateBackupBytes(db))) * 1.2;
    if (files.freeBytes() < needed) {
      throw new AppError('STORAGE_FULL', 'No space to restore', { detail: 'RESTORE' });
    }

    const rawManifest = parseJson(
      await readEntry(reader, manifestEntry, RESTORE_LIMITS.manifestBytes),
      MANIFEST_NAME,
    );
    const header = manifestHeaderSchema.safeParse(rawManifest);
    if (!header.success || header.data.format !== BACKUP_FORMAT)
      throw invalid('NOT_BACKUP', 'not a Hisaab manifest');
    if (
      header.data.formatVersion > BACKUP_FORMAT_VERSION ||
      header.data.schemaVersion > LATEST_SCHEMA_VERSION
    ) {
      throw invalid('NEWER_VERSION', 'made by a newer version');
    }
    const parsedManifest = manifestSchema.safeParse(rawManifest);
    if (!parsedManifest.success)
      throw invalid('DAMAGED', zodReason('manifest', parsedManifest.error.issues));
    const manifest = parsedManifest.data;

    const dataBytes = await readEntry(reader, dataEntry, RESTORE_LIMITS.dataBytes);
    if ((await sha256(dataBytes)) !== manifest.dataSha256)
      throw invalid('DAMAGED', 'data checksum');
    const raw = parseJson(dataBytes, DATA_NAME);
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
      throw invalid('DAMAGED', 'data shape');
    const parsedData = dataSchema.safeParse(
      upgradeData(manifest.schemaVersion, raw as Record<string, unknown>),
    );
    if (!parsedData.success) throw invalid('DAMAGED', zodReason('data', parsedData.error.issues));
    const data = parsedData.data;

    // Extract receipts one at a time, checking each against the manifest.
    const expected = new Map(manifest.files.map((f) => [f.path, f]));
    const staged = new Set<string>();
    for (const entry of receiptEntries) {
      const listed = expected.get(entry.name);
      if (!listed) throw invalid('DAMAGED', 'receipt not in manifest');
      const bytes = await readEntry(reader, entry, RESTORE_LIMITS.receiptBytes);
      if (bytes.length !== listed.sizeBytes || (await sha256(bytes)) !== listed.sha256) {
        throw invalid('DAMAGED', 'receipt checksum');
      }
      await files.writeAll(`${dir}/${entry.name}`, bytes);
      staged.add(entry.name);
    }

    const problem = findIntegrityProblem(data, manifest, staged);
    if (problem) throw invalid('DAMAGED', problem);

    return {
      stagingId,
      source,
      createdAt: manifest.createdAt,
      counts: countsOf(data),
      missingFiles: manifest.missingFiles.length,
      data,
    };
  }

  async function writeJournal(journal: Journal): Promise<void> {
    await files.writeAll(doc(JOURNAL), strToU8(JSON.stringify(journal)));
  }

  async function readJournal(): Promise<Journal | null> {
    const uri = doc(JOURNAL);
    if (!files.exists(uri)) return null;
    try {
      const value = JSON.parse(strFromU8(await files.readAll(uri))) as Partial<Journal>;
      if (
        (value.stage === 'db' || value.stage === 'files') &&
        typeof value.stagingId === 'string'
      ) {
        return value as Journal;
      }
    } catch {
      // Unreadable: written before the DB step began, so the data is unchanged.
    }
    return { stage: 'db', stagingId: '', createdAt: '' };
  }

  function removeStagedRestores(): void {
    for (const name of files.list(cache(STAGING))) {
      if (name.startsWith('restore-')) files.remove(cache(`${STAGING}/${name}`));
    }
  }

  /** Step 5 and 6. Safe to run again after a crash at any point. */
  async function finishFiles(db: DbClient, now: Date): Promise<void> {
    const current = doc(RECEIPTS);
    const incoming = doc(INCOMING);
    const old = doc(OLD);
    if (files.exists(incoming)) {
      if (files.exists(current)) {
        files.remove(old);
        await files.move(current, old);
      }
      await files.move(incoming, current);
    }
    files.remove(old);
    files.remove(doc(JOURNAL));
    removeStagedRestores();
    await deps.sweepOrphans(db, now);
    notifyChanged('all');
  }

  return service;
}

export type BackupService = ReturnType<typeof createBackupService>;
