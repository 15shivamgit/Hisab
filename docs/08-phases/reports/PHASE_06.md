# Phase Report — Phase 6: Backup, restore, CSV export, delete all data

Date: 2026-10-28 · Branch: `main`

**Status: acceptance criteria verified (exceptions in § 5) — awaiting owner approval.** The owner now has the first signed release APK (Hisaab 1.0.0, versionCode 1) on the phone, with their data moved into it through backup and restore.

## 1. What was implemented

- **Backup (BAK-01, BAK-06, BAK-07):** More → Backup & restore. Shows last backup (or "You have never made a backup." in red), counts and size, the uninstall warning, and the privacy note. Create backup writes `hisaab-backup-YYYY-MM-DD-HHMM.hisaab`:
  - ZIP with `data.json` (one read transaction), receipts, and `manifest.json` with SHA-256 checksums;
  - written one entry at a time through file handles, as `.partial`, re-opened and checked, then renamed;
  - then the share sheet opens. Missing receipt files are listed and reported.
- **Restore (BAK-02…05):**
  - **Checks before anything changes:** the file picker copy goes into staging; the ZIP is read through its central directory with a strict name allowlist (zip-slip) and size, count, and free-space limits; then format/version checks, checksums, Zod schemas for every row, and cross-row integrity checks.
  - **Confirmation:** a typed **RESTORE** dialog shows what comes in and what is replaced.
  - **Applying:** safety backup first (only the latest kept), then one DB transaction with a `restore_marker` and an FK check, then a journaled `receipts/` folder swap.
  - **Crash recovery** runs at startup (step 5). **Undo last restore** uses the safety backup. Cancel deletes the staged files.
- **CSV export (RPT-04):** More → Export CSV with This month / Last month / All entries / Custom. The file has a UTF-8 BOM, CRLF line endings, RFC 4180 quoting, a formula-injection guard, and plain rupee amounts, and opens in the share sheet.
- **Delete all data (SET-06):** typed **DELETE**, with a "Create backup first" button. Default categories come back; settings are kept. Receipts, the safety backup, staging, exports, and leftover restore folders are removed.
- **Backup nudge (DASH-08):** a card under the dashboard header ("Last backup 8 days ago." / "You haven't backed up yet.") with Back up now and a dismiss button (hides it for 3 days).
- **Release signing:** `plugins/withReleaseSigning.js`, release variant only. The build fails without the owner's keystore properties.
- **Debug-only Developer tools:** spike data, crash-test pauses, a nudge test. Not reachable in release builds.
- **Packages (approved 2026-10-26):** fflate 0.8.3, expo-document-picker 58.0.4, expo-sharing 58.0.20.

## 2. Files created or changed

| Area | Files |
|---|---|
| Routes | `src/app/{backup,export,dev-tools}.tsx`, `src/app/(tabs)/more.tsx` |
| Features | `src/features/backup/{BackupScreen,ExportScreen}.tsx`, `src/features/dashboard/components/BackupNudge.tsx`, `DashboardScreen.tsx`, `src/features/devtools/{DevToolsScreen.tsx,spikeData.ts}` |
| Services | `src/services/backup/{backupService,format,integrity,upgrade,index}.ts`, `src/services/{exportService,dataService,backupNudge,appServices}.ts`, `startupService.ts` (recovery step) |
| Data | `src/db/repositories/backupRepository.ts` |
| Libraries | `src/lib/zip/{zipReader,zipWriter}.ts`, `src/lib/csv.ts` |
| Platform | `src/platform/{backupFiles,hash,share}.ts` |
| UI | `src/components/TypedConfirmDialog.tsx`, `src/content/strings.ts` |
| Config | `app.config.ts`, `plugins/withReleaseSigning.js`, `package.json` |
| Tests | `src/lib/zip/zip.test.ts`, `src/lib/csv.test.ts`, `src/services/backup/backup.repo.test.ts`, `src/services/phase6Services.repo.test.ts`, `src/components/TypedConfirmDialog.test.tsx`, `plugins/withReleaseSigning.test.js`, `src/test/{memoryBackupFiles,setup}.ts` |

## 3. Commands and tests actually executed

```
npx expo install fflate expo-document-picker expo-sharing   → 0.8.3 / 58.0.4 / 58.0.20
npx tsc --noEmit                                            → passed
npm run lint                                                → passed (after removing one unused import)
npx jest                                                    → 27 suites, 338 tests passed
  (TypedConfirmDialog "confirm button" test failed once in 7 full runs; passed alone and in the next 6 full runs — P6-5)
npx expo run:android --no-bundler --device emulator-5554    → BUILD SUCCESSFUL in 16m 14s (x86_64 dev build)
APP_VARIANT=release npx expo prebuild --platform android --clean
gradlew :app:signingReport  → first keystore: "public key protected PKCS12 not supported" (file corrupted, P6-1); recreated → OK
gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a → BUILD SUCCESSFUL in 32m 17s, app-release.apk 51,147,770 bytes
apksigner verify --print-certs → Verifies (v2), 1 signer, SHA-256 d3d386b8…4604418a = recorded release fingerprint
aapt dump permissions/badging → CAMERA, VIBRATE, app-private receiver permission; no INTERNET; allowBackup=0x0; targetSdk 36; arm64-v8a + armeabi-v7a
adb install hisaab-1.0.0-vc1.apk → Success (owner's phone)
npx expo run:android --no-bundler (phone) → BUILD SUCCESSFUL in 10m 54s; install timed out once, `adb install -r` → Success (data kept)
```

## 4. Test results

| Check | Result | Evidence |
|---|---|---|
| Unit/repo/component tests | ✅ | 338 passed. Covered: ZIP round trip with signature bytes inside data; rejects non-ZIP, truncated, too many entries, encrypted, ZIP64, local-header mismatch. Backup: contents, checksums, missing files, free space. Restore: round trip A → B, undo, zero-receipt backup, missing-files backup. Rejected without any data or file change: text file, truncated, other ZIP, foreign manifest, newer format/schema, tampered data/receipt, zip-slip (`../`, `\`, extra files), invalid rows, broken references, count mismatch, low space. Failures: safety backup fails, DB step fails, kill before commit, kill after commit, kill mid-swap, repeat recovery. Also CSV rules, export, nudge rule, delete-all, typed dialog, signing plugin |
| Spike: 5,000 entries + 300 × 300 KB receipts, 2 GB emulator | ✅ | Backup 36.2 s (later 23.3 s), 86.1 MB, peak +31 MB PSS. Inspect + restore 52.4 s, peak +52 MB. 300 files after restore |
| Backup file readable by another tool | ✅ | fflate `unzipSync` in Node: 302 entries, counts match |
| Crash recovery (emulator, `am force-stop` during debug pause) | ✅ | Before DB commit → rolled back to 5,010 / 305. After commit → finished at 5,000 / 300. No leftover folders or journal |
| Backup screen → share sheet → "Backup created" | ✅ | Emulator and phone; last-backup date updates |
| Restore from file picker with typed RESTORE | ✅ | Emulator: 5,010/305 → 5,000/300; dashboard after restore |
| Undo last restore → Cancel | ✅ | Dialog shows the safety backup (5,010 / 305); cancel empties staging |
| Export CSV (All entries) | ✅ | Share sheet; file has BOM `EF BB BF`, header, 5,000 rows |
| Backup nudge + dismiss | ✅ | "Last backup 8 days ago." + Back up now; dismissed → hidden |
| Delete all data with DELETE | ✅ | Welcome card; `receipts/`, `backups/`, `staging/`, `exports/` gone (AC-38) |
| Release APK | ✅ | Signed with the release key; no INTERNET; installed and opened on the phone; no Developer tools in More |
| **Round trip with the owner's real data** | ✅ | Hisaab Dev on the phone (4 entries, 3 receipts) → backup in ~1 s (712 KB) → release Hisaab (separate app, empty storage) → inspect 4 s, restore 4 s → same dashboard (₹50,000 / ₹8,940 / ₹41,060) and all 3 receipts shown |
| Owner's dev data after the dev-app reinstall | ✅ | Unchanged |

## 5. Known issues and risks

| ID | Priority | Description | Plan |
|---|---|---|---|
| P6-1 | — | The first keystore was corrupted about 18 min after it was made: every `0x00`/`0x0D` byte had become space/newline, most likely because it was opened and saved in Notepad. Nothing had been signed. | Deleted and recreated; warning added to BUILD_AND_RELEASE.md. Fingerprints recorded |
| P6-2 | P2 | Not checked by me: the CSV opened in Excel / Google Sheets with ₹ and Hindi text (encoding is unit-tested and the BOM was checked on the device). | Owner: export once and open it in Google Sheets |
| P6-3 | P3 | The spec's round trip says "phone → emulator". It was done phone (Hisaab Dev) → phone (release Hisaab, a separate app with empty storage), so the owner's photos were not copied to the emulator. | Owner can ask for the emulator leg; the emulator restore path itself was tested with spike data |
| P6-4 | P3 | On the emulator the Backup screen's backup took 79–83 s against 23–36 s from Developer tools: software rendering of the spinner competes for CPU (99% janky frames). On the phone a small backup took ~1 s. A 300-receipt backup was not timed on the phone. | Recheck if the owner finds backups slow; the duplicate button spinner was already removed |
| P6-5 | P3 | Flaky component tests under heavy load: TypedConfirmDialog (1 of 7 full runs) and TXN-09 TransactionForm (1 run). Both pass alone and on reruns; the failure text wasn't captured. | Phase 10: catch the message and fix (likely the 5 s default timeout) |
| P6-6 | P3 | Share sheet can't tell if the file was saved; closing it counts as "Backup created" (owner agreed). | — |
| P6-7 | — | Not possible yet: "backup from schema v1 restores into schema v2" (no v2 until udhaar), udhaar CSV, reminders cancelled on delete-all, document picker / share sheet under app lock. | Phases 7 and 9; `upgrade.ts` is ready for the v1 → v2 step |
| P6-8 | P3 | The release APK grew from 42.8 MB (Phase 2) to 51.1 MB. | Watch; consider removing unused native modules in Phase 10 |

## 6. Documentation updated

BACKUP_AND_RESTORE (Verify results, spike and crash-test results, implementation notes), DECISIONS (ADR-009 amendment), TECH_STACK (3 packages, Phase 6 findings), SERVICES_AND_LIBS, REPOSITORIES, ARCHITECTURE (startup step 5, restore files), UI_COPY, REPORTS_AND_EXPORT, SCREENS_AND_NAVIGATION, DASHBOARD, SETTINGS_AND_APP_LOCK, BUILD_AND_RELEASE (plugin, keystore, fingerprints), ENVIRONMENT_SETUP (emulator, binary copies), DEVELOPMENT_PHASES, PROJECT_CONTEXT, CHANGELOG (with the first build record).

## 7. Exact next steps

1. Owner uses the **release Hisaab** app from now on: make a backup and save it to Google Drive (share sheet → Drive).
2. Owner exports a CSV once and opens it in Google Sheets (P6-2).
3. Owner approves Phase 6.
4. Phase 7 — Udhaar: people, gave/got ledger, balances, return-by reminders (`expo-notifications`, approved in TECH_STACK), WhatsApp/SMS reminder message, udhaar CSV, migration 2 + backup upgrade v1 → v2.

## Owner approval

- [x] Approved to start Phase 7 — owner, 2026-10-28
