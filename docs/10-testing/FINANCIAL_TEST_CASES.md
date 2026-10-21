# Financial Test Cases

Status: Approved · Last updated: 2026-10-21

Golden cases for [../01-requirements/FINANCIAL_RULES.md](../01-requirements/FINANCIAL_RULES.md). Each case MUST exist as an automated test whose name starts with its ID. Assume today = **2026-10-21**, timezone Asia/Kolkata, week starts Monday, unless stated.

## FIN-M — Money parsing and formatting

| ID | Input | Expected |
|---|---|---|
| FIN-M01 | `"450"` | 45000 |
| FIN-M02 | `"1,00,000.5"` | 10000050 |
| FIN-M03 | `".5"` | 50 |
| FIN-M04 | `" 450 "` | 45000 (trimmed) |
| FIN-M05 | `"100,000.75"` | 10000075 (commas ignored) |
| FIN-M06 | `"0"`, `"0.00"` | error `amount.zero` |
| FIN-M07 | `"-10"` | error `amount.invalid` |
| FIN-M08 | `"1.234"` | error `amount.decimals` |
| FIN-M09 | `"10000000"` (₹1 crore) | 1000000000 |
| FIN-M10 | `"10000000.01"` | error `amount.max` |
| FIN-M11 | `""`, `"   "`, `"abc"`, `"1e3"`, `"1.2.3"` | error |
| FIN-M12 | `parse("0.1") + parse("0.2")` | 30 (exact) |
| FIN-M13 | `formatPaise(12500050)` | `₹1,25,000.50` |
| FIN-M14 | `formatPaise(10000000, {compact:true})` | `₹1,00,000` |
| FIN-M15 | `formatPaise(5)` | `₹0.05` |
| FIN-M16 | `paiseToRupeeString(123450)` (CSV) | `1234.50` |

## FIN-D — Dates

| ID | Case | Expected |
|---|---|---|
| FIN-D01 | `monthRange('2026-02-10')` | `2026-02-01 … 2026-02-28` |
| FIN-D02 | `monthRange('2028-02-10')` | `2028-02-01 … 2028-02-29` |
| FIN-D03 | `monthRange('2100-02-01')` | `… 2100-02-28` (not leap) |
| FIN-D04 | `monthRange('2026-12-31')` | `2026-12-01 … 2026-12-31` |
| FIN-D05 | `weekRange('2026-01-01', 'monday')` | `2025-12-29 … 2026-01-04` |
| FIN-D06 | `weekRange('2026-10-25', 'monday')` / `'sunday'` | `10-19 … 10-25` / `10-25 … 10-31` |
| FIN-D07 | `isValidLocalDate` on `2026-02-29`, `2028-02-29`, `2026-13-01`, `2026-1-5`, `2026-04-31` | false, true, false, false, false |
| FIN-D08 | `todayLocal(new Date('2026-10-21T18:45:00Z'))` in IST | `2026-10-22` |
| FIN-D09 | Previous month from `2026-03-31` | February 2026 full range (no overflow) |
| FIN-D10 | Custom range start `2026-10-10`, end `2026-10-01` | error |

## FIN-T — Transactions and totals

| ID | Setup | Expected |
|---|---|---|
| FIN-T01 | Oct: income 50,000; expenses 12,000 + 3,000 | income 50,000; expense 15,000; net 35,000 |
| FIN-T02 | Oct: expense 2,000 only | net −2,000 (shown negative, red) |
| FIN-T03 | Expense ₹5,000 dated 2026-10-25 | Oct totals exclude it; "upcoming" = 5,000; listed with Upcoming badge |
| FIN-T04 | Same, clock moved to 2026-10-25 | Included in Oct expense |
| FIN-T05 | Expenses on 2026-10-31 and 2026-11-01 | One in each month |
| FIN-T06 | Empty month | All totals 0 (not null/NaN) |
| FIN-T07 | Insert expense with an income category (bypassing UI) | Rejected by trigger |
| FIN-T08 | Udhaar entries gave 10,000 + got 3,000 exist | Income/expense/net/category totals unchanged |
| FIN-T09 | Delete category used by a transaction | Rejected (`IN_USE` / RESTRICT) |
| FIN-T10 | Delete category with a budget but no transactions | Deleted; budget removed (CASCADE) |
| FIN-T11 | Change type of a category that has transactions or a budget (bypassing UI) | Rejected by trigger `CATEGORY_IN_USE` |
| FIN-T12 | Search `"450"` with entries ₹450.00 (notes "lunch") and ₹45.00 | Only the ₹450.00 entry matches |

## FIN-U — Udhaar

| ID | Entries (in order) | Expected |
|---|---|---|
| FIN-U01 | gave 10,000; got 3,000 | balance +7,000 → "You will get ₹7,000" |
| FIN-U02 | got 8,000; gave 2,000 | −6,000 → "You owe ₹6,000" |
| FIN-U03 | gave 10,000; got 3,000; got 2,000; got 5,000 | running 10,000 / 7,000 / 5,000 / 0 → "Settled" |
| FIN-U04 | gave 5,000; gave 2,000 (top-up); got 1,000 | +6,000 |
| FIN-U05 | balance +7,000, new got 8,000 | `wouldFlip = true`, after −1,000 |
| FIN-U06 | balance +7,000, new got 7,000 | no flip, settled |
| FIN-U07 | U01 then edit got 3,000 → 4,000 | +6,000 |
| FIN-U08 | U01 then delete the got entry | +10,000 |
| FIN-U09 | People: A +7,000, B −6,000, C 0, D +500 | youWillGet 7,500 (2 people); youOwe 6,000 (1 person) |
| FIN-U10 | Any udhaar entries | Budgets and category charts unchanged |
| FIN-U11 | Entry dated 2026-10-22 | Rejected `date.future.udhaar` |
| FIN-U12 | return_by 2026-10-20, balance 7,000 / balance 0 | overdue / not overdue |
| FIN-U13 | return_by 2026-10-28 / 2026-10-29 | due soon / not due soon |
| FIN-U14 | Delete person with entries | `IN_USE` |
| FIN-U15 | Archive person with balance ≠ 0 | Rejected |
| FIN-U16 | Reminder candidates: A due 10-25 bal 7,000; B due 10-25 bal 0; C due 10-19 bal 500 | Only A scheduled |

## FIN-B — Budgets

| ID | Budget | Spent | Expected |
|---|---|---|---|
| FIN-B01 | 10,000 | 7,999 | normal, 79% |
| FIN-B02 | 10,000 | 8,000 | warning, 80% |
| FIN-B03 | 10,000 | 10,000 | warning, 100%, remaining 0 |
| FIN-B04 | 10,000 | 10,000.01 | over, "₹0.01 over" |
| FIN-B05 | 0 | — | rejected |
| FIN-B06 | Food 3,000 | Food 2,000 + Transport 5,000 | Food 66% |
| FIN-B07 | 10,000 | 4,000 + future-dated 9,000 | 40% |
| FIN-B08 | Budget on an income category | rejected by trigger |

## FIN-R — Reports

| ID | Case | Expected |
|---|---|---|
| FIN-R01 | Month report Oct 2026 vs dashboard | Identical totals |
| FIN-R02 | Week 2025-12-29 … 2026-01-04 with entries on 12-30 and 01-02 | Both included |
| FIN-R03 | Feb 2028 report with entry on 02-29 | Included |
| FIN-R04 | Avg spend per day on 2026-10-21, Oct expense 21,000 | ₹1,000/day |

## FIN-X — Backup

| ID | Case | Expected |
|---|---|---|
| FIN-X01 | Backup → wipe → restore | All rows equal; all receipt files byte-identical |
| FIN-X02 | Tampered receipt (checksum mismatch) | Rejected; DB and files unchanged |
| FIN-X03 | ZIP entry `../evil.jpg` or `receipts/x.png` | Rejected before writing anything |
| FIN-X04 | `formatVersion` 99 | Rejected `backup.newer` |
| FIN-X05 | Schema v1 backup into v2 app | Restored; udhaar empty |
| FIN-X06 | Forced error during DB replace | Rollback; old data intact; no `receipts-incoming/` left |
| FIN-X07 | Device-only settings (app lock) before restore | Unchanged after restore |
| FIN-X08 | Backup where one receipt is missing and listed in `missingFiles` | Restored; that receipt shows "Image missing" |
| FIN-X09 | Attachment row without a file and not in `missingFiles` | Rejected `backup.damaged`; nothing changed |
| FIN-X10 | Free space below (backup uncompressed + safety backup) × 1.2 | Rejected `STORAGE_FULL` before extracting |
