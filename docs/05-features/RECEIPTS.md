# Feature: Receipts

Status: Approved · Phase: 5 · Requirements: RCP-01…07 · Decision: ADR-008

## Sources

- **Take photo** — `expo-image-picker` camera (CAMERA permission, asked on first use).
- **Choose from gallery** — Android photo picker (no storage permission). Multiple selection up to the remaining slots.
- Both are opened through `appLockService.runWithoutLock` (ADR-016).
- If Android kills Hisaab while the camera is open (low memory), the photo result is recovered on restart with `ImagePicker.getPendingResultAsync()` and the user is returned to a new form with that receipt attached. `Verify:` API on the current SDK.

## Import pipeline (`receiptService.prepareFromPicker`)

1. Reject if the transaction already has 5 receipts.
2. Check MIME/extension: accept `image/jpeg`, `image/png`, `image/webp`, `image/heic`/`heif` (`Verify:` HEIC decode support via image-manipulator on Android). Else `UNSUPPORTED_FILE`.
3. Reject input > 25 MB ("This image is too large (32 MB). Max 25 MB.").
4. Check free space ≥ 50 MB, else `STORAGE_FULL`.
5. **Apply the EXIF orientation first** (so the saved image is upright), then resize so the longest edge ≤ 1600 px (never upscale), encode JPEG quality 0.7 → write to `cache/staging/<uuid>.jpg`. Strip EXIF (location) — re-encoding does this. `Verify:` output is upright and EXIF-free for portrait and landscape photos on at least two phones.
6. Return a draft `{ stagedUri, width, height, sizeBytes }`. The original picker URI is never stored.

## Persisting

- On transaction save: for each draft, move the staged file to `<documentDirectory>/receipts/<attachmentId>.jpg`, then insert the attachment rows in the same DB transaction as the transaction itself.
- If the DB write fails, delete the moved files.
- If the app is killed between file move and DB commit, the file becomes an orphan and is removed by the sweep.
- DB stores only `receipts/<attachmentId>.jpg`. Absolute paths are computed at runtime (the app's document directory path can change between installs/restores).

## Viewing

- Form and detail show thumbnails (tap to open viewer).
- Full-screen viewer: swipe between receipts, pinch-zoom, double-tap zoom, close button, "Replace", "Delete", page indicator "2 / 3".
- Missing file (`resolveUri` → null): grey tile "Image missing" with "Remove" action. Never crash.

## Replace / delete

- Replace: pick new image → pipeline → new file written → DB swap in one transaction → old file deleted.
- Delete: confirm "Delete this receipt?" → row deleted → file deleted.
- In the add/edit form before saving, removing a draft just deletes the staged file.
- In the **edit** form, adding or removing saved receipts takes effect only when the form is saved (`transactionService.update` with `receiptChanges`). Discarding the form leaves receipts unchanged. Replace/Delete from the viewer on the detail screen apply immediately.

## Orphan sweep (RCP-07)

Run at most once every 7 days after startup (non-blocking) and after restore:
- Files in `receipts/` whose relative path is not in `attachmentRepository.allRelativePaths()` **and** modified > 1 hour ago → delete.
- `cache/staging` files older than 1 day → delete.
- Never delete anything outside `receipts/` and `cache/staging/`.

## Errors

| Situation | Message |
|---|---|
| Camera permission denied | "Camera access is off. You can still choose a photo from your gallery, or allow camera in Settings." [Open settings] [Use gallery] |
| Unsupported file | "This file type isn't supported. Please choose a photo." |
| Too large | "This image is too large (X MB). Max 25 MB." |
| Low storage | "Not enough free space on your phone to save this receipt." |
| Compression failed | "Couldn't process this image. Try another one." |

## Acceptance

- Receipt still visible after app restart and navigating away/back.
- Deleting a transaction deletes its receipt files (verified by listing `receipts/` in a debug screen or test).
- Replacing a receipt leaves no orphan file.
- Picker temp URI deleted by the OS → saved receipt still opens.
- A 12 MP photo ends up ≤ ~500 KB and text on a printed bill is readable at zoom.
- Photos taken in portrait and landscape are saved upright.
- Removing a receipt in the edit form and then discarding the form keeps the receipt.
