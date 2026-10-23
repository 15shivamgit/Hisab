// Receipt images (RECEIPTS.md, RCP-01…07, ADR-008). Built with injected file, image, and
// clock dependencies so it can be tested in Node; the app instance is src/services/receipts.ts.

import { notifyChanged } from '@/db/changes';
import type { DbClient } from '@/db/client';
import { attachmentRepository, type NewAttachment } from '@/db/repositories/attachmentRepository';
import { markDataChanged } from '@/db/repositories/settingsRepository';
import type { Attachment } from '@/db/types';
import type { Clock } from '@/lib/clock';
import { AppError } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { isSafeReceiptPath, receiptRelativePath } from '@/lib/paths';
import type { ImageProcessor } from '@/platform/images';
import type { PickedAsset } from '@/platform/picker';
import type { ReceiptFileStore } from '@/platform/receiptFiles';

export const MAX_INPUT_BYTES = 25 * 1024 * 1024;
export const MIN_FREE_BYTES = 50 * 1024 * 1024;
export const MAX_EDGE_PX = 1600;
export const JPEG_QUALITY = 0.7;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const ACCEPTED_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

/** A compressed image waiting in cache/staging; not stored anywhere permanent yet. */
export interface ReceiptDraft {
  stagedUri: string;
  width: number;
  height: number;
  sizeBytes: number;
}

/** A draft moved into receipts/, ready to be inserted with its transaction. */
export type StoredReceipt = Omit<NewAttachment, 'transactionId'> & { relativePath: string };

const CHANGED = ['transaction_attachments', 'transactions', 'app_settings'] as const;

function isAcceptedType(asset: PickedAsset): boolean {
  if (asset.mimeType) return ACCEPTED_MIME.includes(asset.mimeType.toLowerCase());
  return ACCEPTED_EXT.test(asset.fileName ?? asset.uri);
}

export function createReceiptService(deps: { files: ReceiptFileStore; images: ImageProcessor }) {
  const { files, images } = deps;

  function removeQuietly(uri: string): void {
    try {
      files.remove(uri);
    } catch {
      // The orphan sweep retries later.
    }
  }

  const service = {
    /** Step 1–6 of the import pipeline: validate, check space, compress into staging. */
    async prepare(asset: PickedAsset): Promise<ReceiptDraft> {
      if (!isAcceptedType(asset)) {
        throw new AppError('UNSUPPORTED_FILE', 'Not an image', { detail: 'UNSUPPORTED_FILE' });
      }
      const inputSize = asset.fileSize ?? files.size(asset.uri);
      if (inputSize !== null && inputSize > MAX_INPUT_BYTES) {
        throw new AppError('VALIDATION', 'Image larger than 25 MB', { detail: 'TOO_LARGE' });
      }
      if (files.freeBytes() < MIN_FREE_BYTES) {
        throw new AppError('STORAGE_FULL', 'Less than 50 MB free', { detail: 'STORAGE_FULL' });
      }
      let processed;
      try {
        processed = await images.toJpeg(asset.uri, MAX_EDGE_PX, JPEG_QUALITY);
      } catch (error) {
        throw new AppError('UNKNOWN', 'Could not process image', {
          detail: 'COMPRESS_FAILED',
          cause: error,
        });
      }
      const stagedUri = files.stagingUri(`${newId()}.jpg`);
      await files.move(processed.uri, stagedUri);
      return {
        stagedUri,
        width: processed.width,
        height: processed.height,
        sizeBytes: files.size(stagedUri) ?? 0,
      };
    },

    /** Removing a draft from the form just deletes its staged file. */
    discard(drafts: readonly ReceiptDraft[]): void {
      for (const d of drafts) removeQuietly(d.stagedUri);
    },

    /** Moves drafts into receipts/<id>.jpg. On failure, moves the done ones back to staging. */
    async store(drafts: readonly ReceiptDraft[]): Promise<StoredReceipt[]> {
      const stored: StoredReceipt[] = [];
      try {
        for (const draft of drafts) {
          const id = newId();
          const relativePath = receiptRelativePath(id);
          await files.move(draft.stagedUri, files.documentUri(relativePath));
          stored.push({
            id,
            relativePath,
            sizeBytes: draft.sizeBytes,
            width: draft.width,
            height: draft.height,
          });
        }
        return stored;
      } catch (error) {
        await service.unstore(stored, drafts);
        throw error;
      }
    },

    /**
     * Undo of `store` when the DB write fails: files go back to their staged URIs so the
     * form still has its drafts and Save can be tried again. If a move back fails, the file
     * is deleted instead (never left as an orphan).
     */
    async unstore(
      stored: readonly StoredReceipt[],
      drafts: readonly ReceiptDraft[],
    ): Promise<void> {
      for (const [index, receipt] of stored.entries()) {
        const uri = files.documentUri(receipt.relativePath);
        const draft = drafts[index];
        try {
          if (!draft) throw new Error('no draft');
          await files.move(uri, draft.stagedUri);
        } catch {
          removeQuietly(uri);
        }
      }
    },

    /** Deletes receipt files; errors are ignored (the orphan sweep will retry). */
    deleteFiles(relativePaths: readonly string[]): void {
      for (const path of relativePaths) {
        if (isSafeReceiptPath(path)) removeQuietly(files.documentUri(path));
      }
    },

    /** Absolute URI to show, or null when the path is unsafe or the file is gone. */
    resolveUri(relativePath: string): string | null {
      if (!isSafeReceiptPath(relativePath)) return null;
      const uri = files.documentUri(relativePath);
      return files.exists(uri) ? uri : null;
    },

    /** RCP-05: new file in, then one DB transaction swaps the rows, then the old file goes. */
    async replace(
      db: DbClient,
      clock: Clock,
      attachmentId: string,
      draft: ReceiptDraft,
    ): Promise<Attachment> {
      const now = clock.now();
      const [stored] = await service.store([draft]);
      if (!stored) throw new AppError('UNKNOWN', 'Receipt not stored');
      let oldPath: string;
      let created: Attachment;
      try {
        ({ oldPath, created } = await db.transaction(async (tx) => {
          const old = await attachmentRepository.getById(tx, attachmentId);
          if (!old) {
            throw new AppError('NOT_FOUND', 'Attachment not found', { detail: 'ATTACHMENT' });
          }
          await attachmentRepository.delete(tx, attachmentId);
          const inserted = await attachmentRepository.insert(
            tx,
            { ...stored, transactionId: old.transactionId, sortOrder: old.sortOrder },
            now,
          );
          await markDataChanged(tx, now);
          return { oldPath: old.relativePath, created: inserted };
        }));
      } catch (error) {
        service.deleteFiles([stored.relativePath]);
        throw error;
      }
      service.deleteFiles([oldPath]);
      notifyChanged(CHANGED);
      return created;
    },

    /** RCP-05: delete one receipt from the viewer (row, then file). */
    async remove(db: DbClient, clock: Clock, attachmentId: string): Promise<void> {
      const now = clock.now();
      const { relativePath } = await db.transaction(async (tx) => {
        const r = await attachmentRepository.delete(tx, attachmentId);
        await markDataChanged(tx, now);
        return r;
      });
      service.deleteFiles([relativePath]);
      notifyChanged(CHANGED);
    },

    /**
     * RCP-07: deletes receipt files no row points to (older than 1 hour, so a save in
     * progress is never touched) and staging files older than 1 day. Never touches
     * anything outside receipts/ and cache/staging/.
     */
    async sweepOrphans(db: DbClient, now: Date): Promise<{ receipts: number; staging: number }> {
      const referenced = await attachmentRepository.allRelativePaths(db);
      const nowMs = now.getTime();
      let receipts = 0;
      for (const file of files.listDocumentFolder('receipts')) {
        const relativePath = `receipts/${file.name}`;
        const oldEnough = file.modifiedMs !== null && nowMs - file.modifiedMs > HOUR_MS;
        if (!referenced.has(relativePath) && oldEnough) {
          removeQuietly(file.uri);
          receipts++;
        }
      }
      let staging = 0;
      for (const file of files.listStaging()) {
        if (file.modifiedMs !== null && nowMs - file.modifiedMs > DAY_MS) {
          removeQuietly(file.uri);
          staging++;
        }
      }
      return { receipts, staging };
    },
  };
  return service;
}

export type ReceiptService = ReturnType<typeof createReceiptService>;
