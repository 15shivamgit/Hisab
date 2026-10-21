# Acceptance Criteria (whole app)

Status: Approved · Last updated: 2026-10-21

Verified in Phase 10 (and earlier phases where listed). Method: **A** = automated test, **M** = manual on a real device, **E** = Maestro E2E.

| ID | Criterion | Method | Phase |
|---|---|---|---|
| AC-01 | Transactions persist after force-stop, app restart, and phone reboot | A + M | 4 |
| AC-02 | Transactions can exist without receipts | A | 4 |
| AC-03 | Receipt images remain available after restart and navigation | M | 5 |
| AC-04 | Replacing or deleting receipts, or deleting a transaction, leaves no orphan files | A + M | 5 |
| AC-05 | Missing receipt file shows a placeholder, never a crash | A + M | 5 |
| AC-06 | Invalid input is rejected with clear inline messages (FIN-M*, form tests) | A | 4, 7 |
| AC-07 | Month boundaries, week boundaries, and leap years are correct (FIN-D*, FIN-R*) | A | 3, 8 |
| AC-08 | Future-dated transactions are excluded from totals until their date (FIN-T03/04) | A | 4 |
| AC-09 | Lending ₹10,000 and receiving ₹3,000 back shows "You will get ₹7,000" | A + E | 7 |
| AC-10 | Borrowing ₹8,000 and returning ₹2,000 shows "You owe ₹6,000" | A | 7 |
| AC-11 | Multiple partial returns show correct running balances and history | A | 7 |
| AC-12 | Udhaar never affects income, expense, net, budgets, or category reports | A | 7 |
| AC-13 | Flip warning appears when an entry changes balance direction | A + E | 7 |
| AC-14 | Person with entries cannot be deleted; non-settled person cannot be archived | A | 7 |
| AC-15 | Reminder notification fires on the return-by date; denial is handled | M | 7 |
| AC-16 | WhatsApp / SMS / share reminder opens with the correct pre-filled text | M | 7 |
| AC-17 | Budget states normal / warning / over are correct (FIN-B*) | A | 8 |
| AC-18 | Invalid, tampered, zip-slip, and newer-version backups do not change existing data (FIN-X*) | A | 6 |
| AC-19 | After restore, DB references and receipt files are consistent | A + M | 6 |
| AC-20 | Interrupted restore recovers to a consistent state on next launch | M | 6 |
| AC-21 | Backup/restore of 300 receipts + 5,000 transactions completes on the slowest test device | M | 6 |
| AC-22 | All features work in airplane mode | M | 10 |
| AC-23 | Release APK has no INTERNET permission (or documented exception) | M | 11 |
| AC-24 | App lock blocks all data until authenticated; timeout respected | M | 9 |
| AC-25 | Light and dark themes have readable contrast on every screen | M | 9 |
| AC-26 | Font scale 200%: no clipped amounts or hidden buttons | M | 10 |
| AC-27 | TalkBack can add an expense end-to-end | M | 10 |
| AC-28 | Dashboard loads < 2 s with 5,000 transactions on a mid-range phone | M | 10 |
| AC-29 | Release APK installs and launches on a real phone | M | 6, 11 |
| AC-30 | Installing a newer APK over an older one keeps all data | M | 11 |
| AC-31 | Two phones with the same APK keep separate data (documented; quick check on two devices) | M | 11 |
| AC-32 | `typecheck`, `lint`, and all tests pass | A | every phase |
| AC-33 | Receipt photos taken in portrait and landscape are saved upright | M | 5 |
| AC-34 | Returning from camera/share within 5 min doesn't lock; form input intact (lock timeout "Immediately") | M | 9 |
| AC-35 | Udhaar reminder still fires after a phone reboot | M | 7 |
| AC-36 | Every write use case sets `data_changed_since_backup` | A | 3–7 |
| AC-37 | Diagnostic report contains no amounts, names, phone numbers, or notes | A | 9 |
| AC-38 | Delete all data leaves no receipts, safety backup, or export files in app storage | A + M | 6 |

## Manual device matrix

| Device | Android version | RAM | Used for |
|---|---|---|---|
| Owner's phone | (fill) | (fill) | Daily use, all M checks |
| Emulator — low-end profile | min supported | 2 GB | Performance, backup spike |
| Emulator — latest Android | latest | 4 GB+ | Permissions, notifications behaviour |
| A friend's phone (if available) | (fill) | (fill) | Install/update test |
