# Phase Report — Phase 5: Receipts

Date: 2026-10-23 · Branch: `main`

**Status: acceptance criteria verified on the phone, with the exceptions in § 5 — awaiting owner approval.** The owner can attach receipt photos to entries and view them full screen.

## 1. What was implemented

- **Sources (RCP-01):** "Add receipt" sheet with Take photo (camera, CAMERA asked on first use) and Choose from gallery (Android photo picker, multiple selection up to the remaining slots, no storage permission). Camera denied → "Camera access is off" dialog with Open settings / Use gallery.
- **Import pipeline (RCP-02):** type check (JPEG/PNG/WebP/HEIC/HEIF), 25 MB input limit, 50 MB free-space check, EXIF orientation applied, longest edge ≤ 1600 px, JPEG quality 0.7 into `cache/staging/`. Re-encoding strips EXIF/GPS. Error toasts per RECEIPTS.md § Errors.
- **Persisting (RCP-03):** drafts move to `receipts/<uuid>.jpg` on save, inside the same flow as the transaction write. If the DB write fails, the files are moved back to staging (`unstore`) so the form can retry. Max 5 per entry. In the edit form, adding/removing receipts takes effect only on Save; Discard keeps everything.
- **Viewing (RCP-04/05):** thumbnails in the form and on the detail screen; full-screen viewer with swipe between receipts, page indicator "1 / 2", pinch zoom 1×–5× (stays after the fingers lift), double-tap 2.5× toggle, pan only while zoomed and clamped to the edges, Replace and Delete (with confirmation).
- **Missing file (RCP-06):** viewer shows "Image missing" with a Remove button; no crash.
- **Orphan sweep (RCP-07):** at most once every 7 days, 3 s after startup, never blocking the UI (`last_orphan_sweep_at`).
- **Camera process death:** if Android kills Hisaab while the camera is open, the photo is recovered on the next start and a new expense opens with it attached.
- **Packages:** expo-image-picker 58.0.10, expo-image-manipulator 58.0.15 (approved in TECH_STACK). `react-native-zoom-toolkit` 5.1.1 was approved and tried, then **removed** (§ 5, P5-1). Zoom is our own component.

## 2. Files created or changed

| Area | Files |
|---|---|
| Routes | `src/app/receipt/[transactionId].tsx` (new), `src/app/_layout.tsx` (GestureHandlerRootView), `src/app/(tabs)/_layout.tsx` (camera-photo recovery) |
| Features | `src/features/receipts/{ReceiptViewerScreen.tsx,useReceiptPicker.tsx,pendingPhoto.ts,zoomMath.ts}`, `components/{ReceiptsField,ReceiptThumb,ZoomableImage}.tsx`; `TransactionEditorScreen.tsx`, `TransactionDetailScreen.tsx`, `components/TransactionForm.tsx` (receipts slot) |
| Services / data | `src/services/{receiptService,receipts,housekeeping}.ts`, `transactionService.ts` (create/update/delete with receipts); `attachmentRepository.ts` (`sortOrder`, `getById`, `deleteForTransaction`) |
| Platform | `src/platform/{picker,images,receiptFiles}.ts` |
| UI | `src/components/ConfirmDialog.tsx` (`onDismiss`), `src/content/strings.ts` (receipts), `src/features/startup/StartupGate.tsx` (housekeeping) |
| Config | `app.config.ts` (CAMERA permission, expo-image-picker plugin), `package.json` |
| Tests | `src/services/receipts.repo.test.ts`, `src/features/receipts/{zoomMath,pendingPhoto}.test.ts`, `src/test/fakeReceiptFiles.ts`; `TransactionForm.test.tsx` (`findByText` timeout 5 s — was flaky under load) |

## 3. Commands and tests actually executed

```
npx expo install expo-image-picker expo-image-manipulator
npx expo run:android --no-bundler → BUILD SUCCESSFUL in 10m 11s; installed; CAMERA declared, not granted
react-native-zoom-toolkit 5.1.1 installed → tried on the phone → failed (P5-1) → npm uninstall react-native-zoom-toolkit
npx tsc --noEmit    → passed
npm run lint        → first run: 14 errors (react-hooks/immutability on shared-value `.value =`) → switched to .get()/.set() → passed
npx jest            → 21 suites, 290 tests passed
Metro hung once more (white screen) → stopped, waited for port 8081, restarted with --clear → "Android Bundled 56635ms (2076 modules)"
```

## 4. Test results

Phone: vivo V2205, Android 14. Only test images were used (generated on the PC, pushed to `Pictures/HisaabTest`, deleted afterwards).

| Check | Result | Evidence |
|---|---|---|
| Unit/repo/service tests | ✅ | 290 passed: pipeline limits and errors, store/unstore rollback, 5-receipt limit, edit add/remove on save, delete removes files, replace, remove, missing file → `null`, orphan sweep rules (1 h / 1 day, never outside the two folders), housekeeping interval, zoom maths, camera-photo recovery hand-off |
| Gallery pick without storage permission | ✅ | Photo picker opened; no storage permission declared or requested |
| EXIF orientation + strip (4000×3000 JPEG stored sideways, Orientation 6, GPS tag) | ✅ | Saved file 1200×1600, upright (red band at the bottom), 51 KB, no EXIF segment |
| Add 2 receipts in a new expense → Save | ✅ | Form "Receipts (2/5)"; 2 files in `receipts/`; `cache/staging/` empty |
| Detail thumbnails → viewer → swipe | ✅ | "1 / 1", then "2 / 2" after a swipe |
| Zoom: double-tap, pan to the edge | ✅ | Zoomed to 2.5× and stayed; drag stopped at the image edge |
| Zoom: pinch, double-tap back, pan (owner) | ✅ | Owner checked on the phone: "sab thik hai" |
| Replace from the viewer | ✅ | Old file gone, new file present, staging empty |
| Delete from the viewer | ✅ | Confirmation → "Receipt deleted" → back to detail; file gone (see P5-3) |
| Edit: remove a receipt → Discard | ✅ | Detail still shows 2 thumbnails; both files still present |
| Edit: remove a receipt → Save | ✅ | "Entry updated"; 1 thumbnail; 1 file |
| Delete entry with receipts | ✅ | Dialog "…deleted with its 1 receipt…" → "Entry deleted"; `receipts/` empty |
| Receipt visible after app restart | ✅ | Receipt still opened after force-stop and Metro restart |
| Camera permission denied | ✅ | "Don't allow" → "Camera access is off" dialog → Use gallery opened the photo picker (permission flags reset afterwards) |
| Orphan sweep ran on the phone | ✅ | `last_orphan_sweep_at` = 2026-10-23T06:41Z in the phone DB (read-only copy) |
| Normal start does not open a form | ✅ | After adding camera-photo recovery, app starts on Home |
| Real camera photo | ⏳ | Not taken by me (it would photograph the owner's surroundings) — P5-2 |

## 5. Known issues and risks

| ID | Priority | Description | Plan |
|---|---|---|---|
| P5-1 | — | `react-native-zoom-toolkit` 5.1.1 did not work with gesture-handler 3.3 / Reanimated 4.7 on the phone (zoom snapped back on release; double-tap reset). | Removed; own `ZoomableImage` built on the existing gesture-handler + Reanimated (no new dependency). Owner confirmed it works |
| P5-2 | P2 | Not checked on a device: real camera photos (portrait + landscape), HEIC input, a second phone, recovery after Android kills the app during the camera. | Owner tries "Take photo" while using the app; Phase 10 manual checklist covers a second phone and HEIC |
| P5-3 | P3 | Once, the viewer's delete dialog closed without deleting (tap landed right after the dev menu had been opened and closed). Not reproduced in three later tries, including one after waiting 30 s. | Watch for it; report if seen in normal use |
| P5-4 | P3 | The dev-client tools button (gear) sits on top of the viewer's Delete button. | Dev build only; the release build has no tools button |
| P5-5 | P3 | Photos picked from the gallery may be Google Photos cloud copies; picking one downloads it through Google's app. Hisaab itself makes no network request. | None needed; noted for the owner |
| P5-6 | P3 | The source sheet title is "Add receipt" also when replacing. | Acceptable; can change later if wanted |
| P5-7 | — | App lock does not exist yet, so the picker is not wrapped in `runWithoutLock` (ADR-016). | Phase 9 |

## 6. Documentation updated

TECH_STACK (picker/manipulator versions, patch updates, zoom-toolkit removal, Phase 5 findings), RECEIPTS (zoom behaviour, Verify results, camera recovery), APP_CONFIG (CAMERA + plugin), SECURITY_AND_PRIVACY (permission checks), SERVICES_AND_LIBS (implemented receipt and transaction service signatures), DEVELOPMENT_PHASES, PROJECT_CONTEXT, CHANGELOG.

## 7. Exact next steps

1. Owner uses receipts for a few days, including "Take photo" with the real camera.
2. Owner approves Phase 5.
3. Phase 6 — Backup, restore, CSV export, delete all data. Needs `fflate` (listed in TECH_STACK; approval to be confirmed) and starts with the 300-receipt performance spike (ADR-009).

## Owner approval

- [ ] Approved to start Phase 6 — (owner, date)
