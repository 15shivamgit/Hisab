# Feature: Backup and Restore

Status: Approved · Phase: 6 · Requirements: BAK-01…07 · Decisions: ADR-009, ADR-010, ADR-015

## Why this matters

All data lives only inside the app. **Uninstalling the app, clearing app storage, or losing the phone deletes everything** unless the user has a backup file saved somewhere else (Google Drive app, computer, another phone). Android Auto Backup is disabled (ADR-010), so manual backups are the only protection.

## Backup screen (More → Backup & restore)

- Status: "Last backup: 21 Oct 2026, 9:40 PM" or "You have never made a backup." (red).
- Warning box: "If you uninstall Hisaab or lose this phone, your data is gone unless you have a backup file saved outside the app." (BAK-07)
- [Create backup] → progress → share sheet ("Save to Drive", "Files", WhatsApp to yourself…).
- Privacy note: "Anyone with this file can see your data and receipts. Keep it private."
- [Restore from backup…]
- Counts: "1,240 entries · 312 receipts · 18 people · ~96 MB".

## File format (`formatVersion` 1)

File name: `hisaab-backup-2026-10-21-2140.hisaab` (ZIP container; MIME `application/zip`).

```
manifest.json
data.json
receipts/<attachmentId>.jpg   (0..n)
```

### `manifest.json`

```json
{
  "format": "hisaab-backup",
  "formatVersion": 1,
  "schemaVersion": 2,
  "appVersion": "1.0.0",
  "createdAt": "2026-10-21T16:10:00.000Z",
  "counts": { "categories": 22, "transactions": 1240, "attachments": 312, "people": 18, "udhaarEntries": 97, "budgets": 4 },
  "files": [ { "path": "receipts/3f0c….jpg", "sizeBytes": 231034, "sha256": "…" } ],
  "missingFiles": [ "receipts/9b1d….jpg" ],
  "dataSha256": "…"
}
```

### `data.json`

```json
{
  "settings": { "theme": "system", "week_start": "monday", "reminders_enabled": true, "reminder_time": "09:00" },
  "categories": [ … ], "transactions": [ … ], "transactionAttachments": [ … ],
  "people": [ … ], "udhaarEntries": [ … ], "budgets": [ … ]
}
```

Rows use the DB column names. Device-only settings are excluded.

## Create backup (`backupService.create`)

1. Check free space ≥ estimated size × 1.2 (DB rows + receipt sizes); else `STORAGE_FULL`.
2. Read all data in **one read transaction** (consistent snapshot) → `data.json`.
3. For each attachment: verify the file exists; missing files are listed in a warning ("3 receipts are missing and won't be in the backup") and their rows are still exported (restore will show "Image missing"). Their paths are written to `manifest.missingFiles`.
4. Stream into a ZIP in `cache/exports/` with `fflate` (receipts stored without re-compression — JPEG is already compressed).
5. Compute SHA-256 for `data.json` and each receipt (`expo-crypto`).
6. Re-open the finished ZIP and verify the manifest parses (cheap self-check).
7. Share sheet. On successful share/save: set `last_backup_at = now`, `data_changed_since_backup = false`. (`Verify:` whether the share result reliably reports success on Android; if not, set it when the share sheet closes and say "Backup created".)

## Restore (`backupService.inspect` → confirm → `backupService.restore`)

### 1. Pick and stage (nothing changes yet)

- `expo-document-picker` → copy into `cache/staging/restore-<uuid>/backup.zip`.
- Limits: archive ≤ 2 GB; ≤ 5,000 receipt entries; each receipt ≤ 10 MB; `data.json` ≤ 50 MB; total uncompressed ≤ 2.5 GB.
- Free space (`STORAGE_FULL` if not met), because during a restore the staged backup, its extracted receipts, the safety backup, and the current data all exist at once:
  - before copying the picked file: free ≥ archive size + 50 MB;
  - before extracting: free ≥ (uncompressed size of the backup + estimated size of the safety backup of current data, computed as in `backupService.create` step 1) × 1.2.
- Extract with a **strict allowlist**: only `manifest.json`, `data.json`, and names matching `^receipts/[0-9a-f-]{36}\.jpg$`. Any other entry, absolute path, `..`, backslash, or duplicate name → reject the whole file (zip-slip protection).

### 2. Validate (BAK-03)

| Check | Failure message |
|---|---|
| `format` = `hisaab-backup` | "This is not a Hisaab backup file." |
| `formatVersion` ≤ supported | "This backup was made by a newer version of Hisaab. Please update the app." |
| `schemaVersion` ≤ current; older versions upgraded in memory via `upgrade.ts` | same as above |
| `dataSha256` and each file `sha256` match | "This backup file is damaged." |
| `data.json` passes Zod schemas (types, enums, paise integers, date formats, UUIDs, lengths) | "This backup file is damaged." (+ details in "Show technical details") |
| Referential integrity: every FK points to an existing row; category type matches transaction type; ≤ 5 attachments per transaction; attachment paths match their IDs | "This backup file is damaged." |
| Every attachment row has a staged file **or** its path is in `manifest.missingFiles`; every path in `missingFiles` belongs to an attachment row | "This backup file is damaged." |
| Counts match manifest | "This backup file is damaged." |

Output: a `ValidationReport` with counts and created date.

### 3. Confirm (BAK-02)

Dialog: "Restore backup from 21 Oct 2026? This will **replace all current data** on this phone (1,240 entries, 312 receipts, 18 people). Your current data will be saved as a safety backup first." User must type **RESTORE** or press-and-hold the button.

### 4. Apply (BAK-04, BAK-05)

1. **Safety backup**: create a backup of current data into `backups/pre-restore-<ts>.hisaab` (app-private; only the latest kept). If this fails → abort, nothing changed.
2. Move staged receipts into `receipts-incoming/`.
3. Write journal `restore-journal.json` = `{ stage: "db", stagingId, createdAt }`.
4. **One exclusive DB transaction**: `backupRepository.replaceAll(data)` + `replacePortable(settings)` → `PRAGMA foreign_key_check` must be empty → commit. On any error: rollback, delete `receipts-incoming/`, delete journal → "Restore failed. Your data was not changed."
5. Journal `stage: "files"`. Rename `receipts/` → `receipts-old/`, `receipts-incoming/` → `receipts/`. Delete `receipts-old/`.
6. Delete journal and staging. Set `data_changed_since_backup` = `false` if the source was a user-picked backup file (the data now equals a file outside the app), or `true` if it was "Undo last restore" (the source file lives only inside the app). Run `reminderService.reconcile()` and orphan sweep. `notifyChanged(all)`. Navigate to dashboard: "Backup restored."

### Crash recovery

On startup, if `restore-journal.json` exists:
- `stage: "db"` → DB transaction either committed or not. Detect by comparing a `restore_marker` (the staging ID written into `app_settings` inside the restore transaction). If committed → continue with step 5; if not → delete `receipts-incoming/` and journal.
- `stage: "files"` → finish the directory swap idempotently (whichever renames haven't happened), then clean up.

### Undo

Backup screen shows "Undo last restore" while `backups/pre-restore-*.hisaab` exists — it restores that file using the same flow.

## Backup reminder (BAK-06, DASH-08)

Nudge on dashboard when **all** of:
- `data_changed_since_backup` is true, and
- `last_backup_at` is null and there are ≥ 10 entries (transactions + udhaar entries), **or** `last_backup_at` is older than 7 days, and
- `backup_nudge_dismissed_until` is null or before today.

Dismissing the nudge sets `backup_nudge_dismissed_until = today + 3 days`.

## Phase 6 spike (must pass before finishing the phase)

Generate 300 synthetic receipts (~300 KB each, ~90 MB) + 5,000 transactions on the slowest available test phone/emulator (2–3 GB RAM). Backup and restore must complete without crash; record time and peak memory in this doc. If it fails, propose a native ZIP module (ADR-009 amendment).

## Acceptance

- Invalid, truncated, renamed non-backup, wrong-version, and tampered (checksum) files are rejected with no change to existing data (tests with fixture files).
- A ZIP containing `../evil.jpg` or extra files is rejected.
- After restore, every attachment row has a file and every receipt file has a row (or is reported missing).
- Killing the app during step 4 or 5 (manual test with a debug delay flag) recovers to a consistent state on next launch.
- Backup from schema v1 (before udhaar) restores into schema v2 app.
- A backup with a missing receipt listed in `missingFiles` restores and shows "Image missing"; an attachment row with no file and not listed is rejected.
- Restore with too little free space for the safety backup + extracted files is refused before anything changes.
